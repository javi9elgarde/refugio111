# Refugio 111 como app móvil (PWA)

Qué hay, cómo dejarlo configurado y cómo probarlo.

## Qué hace cada archivo

| Archivo | Para qué |
|---|---|
| `css/mobile-native.css` | Notch y zonas seguras, toques de 44 px, sin selección ni zoom involuntarios, ventanas como hojas inferiores con asa, solo barra inferior en móvil, tableros a una columna. |
| `js/mobile-ui.js` | Deslizar hacia abajo para cerrar las hojas. Vibración ligera (`navigator.vibrate(30)`) en cada aviso verde de guardado. `GT.haptic()` y `GT.isStandalone()`. |
| `js/sync-manager.js` | Aviso de conexión, `safeSaveDoc()` con versiones y transacciones, bandeja de cambios hechos sin red y hoja de conflictos. |
| `js/push-manager.js` | Botón «🔔 Activar avisos» (en la hoja «Más»), permiso, aviso de iOS y token en `pushTokens/{token}`. |
| `sw.js` | Precarga de las 28 páginas y sus JS/CSS, Firebase y Chart.js en caché (la app arranca sin red), eventos `push` y `notificationclick`. |
| `.github/workflows/fcm-notifications.yml` + `.github/scripts/send-release-push.js` | Cada día a las 08:00 UTC manda los avisos de los juegos que salen ese día. |

### Cómo funciona el guardado sin red

Las transacciones de Firestore necesitan conexión, así que:

1. **Con red:** `Biblioteca.update` y `Registro.update` pasan por `safeSaveDoc()`. La transacción lee la versión del servidor; si es mayor que la que tenías al abrir el editor, no guarda nada y comprueba qué ha pasado.
2. **Sin red:** el cambio se guarda en `localStorage` (`GT_outbox`), se ve al momento en todas las páginas y sigue ahí aunque cierres la app. Al volver la conexión se sube con la misma comprobación.
3. **Si alguien guardó antes:**
   - Si cambió campos que tú no tocaste, se combina solo y sale el aviso «Guardado junto con los cambios de otro dispositivo».
   - Si los dos cambiasteis el mismo campo, sale la hoja con la tabla comparativa:
     - **Quedarme con el mío** guarda todo tu formulario y sube la versión.
     - **Usar el del servidor** descarta tus cambios.
     - **Combinar** guarda solo los campos que cambiaste tú y respeta el resto de lo del servidor.

Cada guardado pone `version` (+1) y `actualizadoEn` (hora del servidor). Los documentos antiguos sin `version` cuentan como versión 0.

La regla de «solo cuenta la primera nota de cada juego» no cambia: los cambios pendientes se aplican antes de `firstScoresOnly()`.

> Altas y borrados siguen como antes (Firestore los guarda sin red por su cuenta, y un alta nueva no puede chocar con nada). Las páginas de Películas y Series (`mt-*`) tienen el aviso de conexión, las hojas y los avisos push, pero su guardado no pasa todavía por `safeSaveDoc`.

---

## Configuración (una sola vez)

### 1. Clave VAPID (Firebase Console)

1. Entra en <https://console.firebase.google.com> → proyecto **proyectodmj-f3707**.
2. Abre ⚙️ **Configuración del proyecto** → pestaña **Cloud Messaging**.
3. Comprueba que **API de Firebase Cloud Messaging (V1)** sale «Habilitada». Si no, actívala desde este enlace directo: <https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=proyectodmj-f3707> → **Habilitar**. La «API de Cloud Messaging (heredada)» (`googlecloudmessaging.googleapis.com`) está retirada desde 2024 y su página da error: ni se usa ni hace falta.
4. Baja a **Configuración web** → **Certificados push web** → **Generar par de claves**.
5. Copia la clave (empieza por `B…`, unos 88 caracteres) y pégala en `js/push-manager.js`:
   ```js
   var VAPID_KEY = 'BPx…tu clave…';
   ```
   La clave VAPID **pública** puede ir en el código sin problema.
6. Sube el número de versión de `js/push-manager.js?v=` en las páginas que lo cargan.

### 2. Secreto `FIREBASE_SERVICE_ACCOUNT` (GitHub)

1. Ve a Firebase Console → ⚙️ **Configuración del proyecto** → **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un `.json`.
2. En GitHub, abre `javi9elgarde/refugio111` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
3. En **Name** pon `FIREBASE_SERVICE_ACCOUNT`. En **Secret** pega **todo** el contenido del `.json`, con las llaves `{ }` incluidas.
4. Borra el `.json` de tu ordenador. Esa clave da acceso total a la base de datos: nunca la subas al repositorio.

> GitHub desactiva los workflows programados si el repositorio pasa 60 días sin actividad. Si dejan de llegar avisos, mira la pestaña **Actions**.

### 3. Reglas de seguridad de Firestore

En Firebase Console → **Firestore Database** → **Reglas**, **mantén la función que ya tienes con los tres correos** y añade los bloques nuevos. En este ejemplo esa función se llama `permitido()`; si la tuya se llama de otra forma, usa ese nombre.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ← la que ya tienes: solo entran las cuentas de David, Javi y Mery
    function permitido() {
      return request.auth != null
        && request.auth.token.email in ['correo-david@…', 'correo-javi@…', 'correo-mery@…'];
    }

    // version nunca baja; un documento antiguo sin version cuenta como 0
    function versionValida() {
      return !('version' in request.resource.data)
        || (request.resource.data.version is int
            && request.resource.data.version >= resource.data.get('version', 0));
    }

    match /biblioteca/{id} {
      allow read, create, delete: if permitido();
      allow update: if permitido() && versionValida();
    }
    match /registro/{id} {
      allow read, create, delete: if permitido();
      allow update: if permitido() && versionValida();
    }

    // tokens de avisos: cada dispositivo guarda el suyo
    match /pushTokens/{token} {
      allow read, delete: if permitido();
      allow create, update: if permitido()
        && request.resource.data.token == token
        && request.resource.data.keys().hasOnly(['token', 'jugador', 'plataforma', 'tiposSubscripcion', 'actualizadoEn'])
        && request.resource.data.jugador in ['David', 'Javi', 'Mery', null]
        && request.resource.data.tiposSubscripcion is map;
    }

    // registro de envíos: solo lo escribe el workflow (firebase-admin no pasa por las reglas)
    match /pushLogs/{id} {
      allow read: if permitido();
      allow write: if false;
    }

    // … el resto de colecciones que ya tengas (settings, eventos, mt-…) se quedan igual
  }
}
```

Pulsa **Publicar**. El workflow busca tokens con `tiposSubscripcion.lanzamiento == true`. Firestore crea solo el índice de un campo que necesita esa consulta.

---

## Protocolo de pruebas

Antes de empezar: publica en `main`, abre la web y recarga con Ctrl+F5. En el móvil, cierra la app y vuelve a abrirla para que entre el service worker nuevo. Para comprobar que se ha actualizado: Chrome escritorio → F12 → **Application** → **Service workers**. Debe aparecer `sw.js` activo y en **Cache storage** una caché `refugio111-20261030a` con más de 80 entradas.

### A. Aviso push de un lanzamiento del día

1. **Android (Chrome):** abre la web → menú ⋮ → **Instalar app**. Abre la app.
2. **iPhone (iOS 16.4+):** abre la web en Safari, toca **Compartir** → **Añadir a pantalla de inicio** y abre la app desde el icono. Comprobación: si en vez de eso pulsas «Activar avisos» desde Safari normal, debe salir la hoja «📲 Añade la app a Inicio».
3. Toca **Más** → **🔕 Activar avisos de lanzamientos** → **Permitir**. Debe salir «Avisos activados 🔔» y el botón cambia a «🔔 Avisos activados».
4. En Firestore → `pushTokens` debe aparecer un documento con `jugador`, `plataforma` y `tiposSubscripcion: { lanzamiento: true, chollo: true }`.
5. En la web, edita un juego cualquiera y pon como **fecha de lanzamiento la de hoy**. Apunta la fecha que tenía antes.
6. En GitHub → **Actions** → **Avisos push de lanzamientos** → **Run workflow**:
   - Primero con **dry_run** marcado. El registro debe decir «→ se enviaría: 🎮 ¡Hoy sale …!».
   - Después sin marcar. Debe decir «✓ … → 1 enviados».
7. Con la app cerrada o en segundo plano, llega el aviso con el título del juego. En Android también sale la portada.
8. Toca el aviso: la app se abre en la ficha del juego (`biblioteca.html?open=ID`).
9. **Duplicados:** lanza el workflow otra vez. Debe decir «⏭ ya enviado» y en `pushLogs` hay un documento `lanzamiento_AAAA-MM-DD_ID`.
10. Devuelve el juego a su fecha original. Si quieres repetir la prueba, borra ese documento de `pushLogs`.

Sin cambiar la fecha de un juego también puedes probar otro día: en **Run workflow**, rellena **fecha** con el día de salida de un juego de la biblioteca.

### B. Guardado sin red y sincronización automática

1. Abre **Biblioteca** en el móvil (o en Chrome con F12 → **Network** → **Offline**).
2. Activa el modo avión. Arriba sale **🔴 Sin conexión · Cambios locales activos**.
3. Cambia a otras páginas (Registro, Inicio, Eventos): todas deben abrirse desde la caché.
4. Edita un juego (por ejemplo, el hype o la saga) y guarda. El cambio se ve al momento y el móvil vibra.
5. Cierra la app del todo y vuelve a abrirla, todavía sin red. El cambio debe seguir ahí.
6. Quita el modo avión. Sale «1 cambio sincronizado» y luego **🟢 Sincronizado**, que se va a los 3 s.
7. Desde otro dispositivo o en Firestore, comprueba que el juego tiene el cambio, `version` ha subido en 1 y `actualizadoEn` tiene la hora actual.

### C. Conflicto de edición entre dos clientes

Necesitas dos dispositivos, A y B (o un móvil y el ordenador).

1. Abre la ficha del mismo juego en A y en B.
2. **A:** pon el modo avión y cambia la **saga** a «Saga A». Guarda.
3. **B (con red):** cambia la **saga** a «Saga B» y la **duración** a otro número. Guarda.
4. **A:** quita el modo avión. Sale la hoja **⚠️ Conflicto de edición**:
   - «Saga» en rojo, «cambiado por los dos», con «Saga A» en tu versión y «Saga B» en el servidor.
   - «Duración» marcada como «solo cambió en el servidor».
5. Prueba cada opción (repite los pasos 2–4 entre una y otra):
   - **Combinar:** saga = «Saga A» y la duración de B se conserva.
   - **Quedarme con el mío:** se guarda todo el formulario de A, también la duración antigua.
   - **Usar el del servidor:** A vuelve a ver «Saga B» y su cambio se descarta.
6. **Sin choque:** repite, pero en A cambia solo el **hype** y en B solo la **saga**. Al volver la red no sale ninguna hoja, sale «Guardado junto con los cambios de otro dispositivo» y se conservan los dos cambios.
7. **Con red en los dos:** abre el editor del mismo juego en A y en B. Guarda primero en B y después en A sin cerrar el editor. Debe salir la hoja (A partía de una versión anterior).

### D. Detalles de app

- **Notch (iPhone instalado):** el contenido no se mete bajo el reloj y la barra inferior respeta la raya de inicio.
- **Barra superior:** en móvil no aparece. Se navega con la barra inferior; el cambio de jugador está en **Más**.
- **Hojas:** una ficha de juego, el editor y el selector de logros salen desde abajo con un asa. Al arrastrarlas hacia abajo se cierran; si sueltas antes de un tercio, vuelven a su sitio.
- **Zoom:** al tocar un campo de texto en iPhone, la página no hace zoom.
- **Pulsación larga:** sobre botones o portadas no sale el menú de copiar o compartir.

---

## Siguiente paso: empaquetar

- **Android (Bubblewrap / TWA):** `npx @bubblewrap/cli init --manifest https://javi9elgarde.github.io/refugio111/manifest.webmanifest`. Para que se abra sin la barra del navegador, Android pide `/.well-known/assetlinks.json` en la **raíz del dominio**. En `javi9elgarde.github.io/refugio111` eso no se puede, así que hace falta un dominio propio o el repositorio `javi9elgarde.github.io`.
- **iOS / Android (Capacitor):** copia la web a `www/` y usa `server.url` apuntando a la web publicada, para que los avisos y el service worker sigan funcionando igual. Dentro de Capacitor, los avisos nativos necesitan `@capacitor/push-notifications`; el payload `tipo / titulo / cuerpo / url` ya sirve tal cual.
