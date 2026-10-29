/* ============================================================
   REFUGIO 111 — Temas de la portada (editor en vivo + programación)
   settings/temas = { lista: [tema] }
   tema = { id, nombre, juegoId, desde, hasta (ms), prioridad, confeti,
            colores: { acento, acento2, fondo, panel, borde, titulo, engranaje },
            titulos: { escala, brillo },
            fondos: { izq: { url, size, pos }, der: { url, size, pos }, oscuro, repetir } }
   El tema activo es el de más prioridad cuyo periodo incluye ahora; sin fechas es un borrador.
   ============================================================ */
(function () {
  'use strict';

  var GT = window.GT, CACHE = 'GT_temas';
  var root = document.documentElement, body = document.body;
  var temas = [], timer = null, draft = null, editing = false;

  // control del panel → variable CSS que pinta (los colores vacíos no tocan nada)
  var mix = function (p) { return function (c) { return 'color-mix(in srgb, ' + c + ' ' + p + '%, transparent)'; }; };
  var COLORES = [
    ['acento', 'Acento', ['--party-c', '--r1-y']], ['acento2', 'Acento 2', ['--party-c2', '--r1-y2']], ['fondo', 'Fondo de página', ['--bg']],
    ['panel', 'Paneles', ['--r1-panel'], mix(94)], ['borde', 'Bordes', ['--r1-line', '--border'], mix(60)], ['titulo', 'Títulos', ['--tm-titulo']], ['engranaje', 'Engranaje 111', ['--tm-gear']]
  ];
  var VARS = [].concat.apply([], COLORES.map(function (c) { return c[2]; })).concat(['--tm-h', '--tm-glow', '--tm-izq', '--tm-der', '--tm-izq-size', '--tm-der-size', '--tm-izq-pos', '--tm-der-pos', '--tm-oscuro', '--tm-rep', '--tm-logo']);

  function esc(s) { return GT.Utils.escapeHtml(s == null ? '' : String(s)); }
  function cssUrl(u) { return u ? 'url("' + String(u).replace(/"/g, '%22') + '")' : ''; }
  function nuevo() {
    return { id: 't' + Date.now().toString(36), nombre: 'Tema nuevo', juegoId: '', desde: null, hasta: null, prioridad: 0, confeti: false,
      colores: {}, titulos: { escala: 1, brillo: 12 },
      fondos: { izq: { url: '', size: 'cover', zoom: 100, x: 50, y: 50 }, der: { url: '', size: 'cover', zoom: 100, x: 50, y: 50 }, oscuro: 0.6, repetir: false } };
  }

  /* ── PINTAR ─────────────────────────────────────────────── */
  // las variables van en <body>: así ganan a las de la fiesta automática, que van en <html>
  function apply(t) {
    var s = body.style;
    VARS.forEach(function (v) { s.removeProperty(v); });
    root.classList.remove('r1-tema--acento', 'r1-tema--titulo', 'r1-tema--engranaje', 'r1-tema--fondos', 'r1-tema--logo', 'r1-tema--logo-negro', 'r1-tema--logo-blanco');
    root.classList.toggle('r1-tema', !!t);
    if (!t) return;
    var c = t.colores || {}, ti = t.titulos || {}, f = t.fondos || {};
    COLORES.forEach(function (k) { if (c[k[0]]) k[2].forEach(function (v) { s.setProperty(v, k[3] ? k[3](c[k[0]]) : c[k[0]]); }); });
    ['acento', 'titulo', 'engranaje'].forEach(function (k) { root.classList.toggle('r1-tema--' + k, !!c[k]); });
    s.setProperty('--tm-h', ti.escala || 1);
    s.setProperty('--tm-glow', (ti.brillo == null ? 12 : ti.brillo) + 'px');
    ['izq', 'der'].forEach(function (k) {
      var side = f[k] || {};
      if (side.url) s.setProperty('--tm-' + k, cssUrl(side.url));
      s.setProperty('--tm-' + k + '-size', side.size === 'zoom' ? 'auto ' + (side.zoom || 100) + '%' : side.size || 'cover');
      s.setProperty('--tm-' + k + '-pos', side.x != null ? side.x + '% ' + side.y + '%' : side.pos || 'center');
    });
    root.classList.toggle('r1-tema--fondos', !!((f.izq && f.izq.url) || (f.der && f.der.url)));
    s.setProperty('--tm-oscuro', f.oscuro == null ? 0.6 : f.oscuro);
    s.setProperty('--tm-rep', f.repetir ? 'repeat' : 'no-repeat');
    if (t.logo) s.setProperty('--tm-logo', cssUrl(t.logo));
    root.classList.toggle('r1-tema--logo', !!t.logo);
    if (t.logo && t.logoFondo) root.classList.add('r1-tema--logo-' + t.logoFondo);
    syncGear();
  }

  // capa de tinte sobre las dos piezas del logo, girando a la vez que el engranaje
  function syncGear() {
    var wrap = document.querySelector('.nav__logo-wrap');
    if (!wrap) return;
    if (!wrap.querySelector('.tm-tint')) wrap.insertAdjacentHTML('beforeend', '<i class="tm-tint tm-tint--gear"></i><i class="tm-tint tm-tint--inner"></i>');
    var gear = wrap.querySelector('.nav__logo-gear'), tint = wrap.querySelector('.tm-tint--gear');
    var sync = function () {
      var a = gear && gear.getAnimations ? gear.getAnimations()[0] : null, b = tint.getAnimations ? tint.getAnimations()[0] : null;
      if (a && b) b.currentTime = a.currentTime;
    };
    sync();
    if (!wrap._tmSync) { wrap._tmSync = true; wrap.parentNode.addEventListener('mouseenter', function () { setTimeout(sync); }); wrap.parentNode.addEventListener('mouseleave', function () { setTimeout(sync); }); }
  }

  /* ── PROGRAMACIÓN ───────────────────────────────────────── */
  function activo(now) {
    return temas.filter(function (t) { return t.desde && t.hasta && t.desde <= now && now < t.hasta; })
      .sort(function (a, b) { return (b.prioridad || 0) - (a.prioridad || 0) || b.desde - a.desde; })[0] || null;
  }
  // aplica el tema que toca y se despierta en el siguiente inicio o fin de algún tema
  function schedule() {
    clearTimeout(timer);
    if (editing) return;
    var now = Date.now(), t = activo(now), prev = root.dataset.tema || '';
    apply(t);
    root.dataset.tema = t ? t.id : '';
    if (t && t.confeti && t.id !== prev && GT.confetti) {
      var key = 'GT_tema_conf_' + t.id, seen = false;
      try { seen = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1'); } catch (e) {}
      if (!seen) setTimeout(GT.confetti, 600);
    }
    var next = temas.reduce(function (m, x) {
      [x.desde, x.hasta].forEach(function (d) { if (d && d > now && d < m) m = d; });
      return m;
    }, now + 864e5);
    timer = setTimeout(schedule, Math.min(next - now + 500, 864e5));
  }

  function load(list) {
    temas = Array.isArray(list) ? list : [];
    try { localStorage.setItem(CACHE, JSON.stringify(temas)); } catch (e) {}
    schedule();
    if (editing) renderList();
  }

  /* ── EDITOR ─────────────────────────────────────────────── */
  var panel;
  function toLocal(ms) { if (!ms) return ''; var d = new Date(ms - new Date(ms).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); }
  function estado(t) {
    var now = Date.now();
    if (!t.desde || !t.hasta) return ['Borrador (sin fechas)', 'off'];
    if (now >= t.hasta) return ['Terminado', 'off'];
    if (now < t.desde) return ['Programado', 'prog'];
    return activo(now) && activo(now).id === t.id ? ['Activo ahora', 'on'] : ['En fechas, pero gana otro de más prioridad', 'prog'];
  }

  function open() {
    if (editing) return;
    editing = true;
    clearTimeout(timer);
    if (!panel) build();
    panel.hidden = false;
    root.classList.add('tm-editing');
    var cur = activo(Date.now()) || temas[0];
    edit(cur ? JSON.parse(JSON.stringify(cur)) : nuevo());
  }
  function close() {
    editing = false;
    if (panel) { preview(false); panel.hidden = true; }
    root.classList.remove('tm-editing');
    if (location.hash === '#editor') history.replaceState(null, '', location.pathname + location.search);
    schedule();
  }

  function build() {
    var row = function (k) {
      return '<label class="tm-row tm-row--c"><span>' + k[1] + '</span>' +
        (window.EyeDropper ? '<button type="button" class="tm-pick" data-pick="' + k[0] + '" title="Cuentagotas: coger un color de la pantalla">💧</button>' : '<i></i>') +
        '<input type="color" data-c="' + k[0] + '"><button type="button" class="tm-x" data-clear="' + k[0] + '" title="Quitar (usar el normal)">✕</button></label>';
    };
    var side = function (k, t) {
      return '<fieldset class="tm-side" data-side="' + k + '"><legend>' + t + '</legend>' +
        '<input type="url" class="tm-in" data-f="' + k + '.url" placeholder="URL de la imagen">' +
        '<select class="tm-in" data-f="' + k + '.size"><option value="cover">Cubrir</option><option value="contain">Contener</option><option value="100% 100%">Estirar</option><option value="zoom">Zoom a mano</option></select>' +
        range(k + '.zoom', 'Zoom', 50, 300) + range(k + '.x', 'Horizontal', 0, 100) + range(k + '.y', 'Vertical', 0, 100) + '</fieldset>';
    };
    var range = function (f, t, min, max) {
      return '<label class="tm-row"><span>' + t + '</span><input type="range" min="' + min + '" max="' + max + '" step="1" data-f="' + f + '"><output data-o="' + f + '"></output></label>';
    };
    panel = document.createElement('aside');
    panel.className = 'tm-panel';
    panel.setAttribute('aria-label', 'Editor de temas');
    panel.innerHTML =
      '<header class="tm-head"><b>🎨 EDITOR DE TEMAS</b><span><button type="button" class="tm-close" data-act="flip" title="Mover el panel al otro lado">⇄</button> <button type="button" class="tm-close" data-act="close" title="Cerrar (Esc)">✕</button></span></header>' +
      '<div class="tm-body">' +
        '<section><h3>Tema</h3><div class="tm-2"><select class="tm-in" id="tmList"></select><button type="button" class="tm-btn" data-act="new">＋ Nuevo</button></div>' +
          '<input class="tm-in" data-k="nombre" placeholder="Nombre del tema">' +
          '<input class="tm-in" data-k="juego" list="tmGames" placeholder="Juego asociado (opcional)"><datalist id="tmGames"></datalist>' +
          '<input type="url" class="tm-in" data-k="logo" placeholder="Logo para el cartel «Hoy sale» (URL, mejor PNG)">' +
          '<select class="tm-in" data-k="logoFondo"><option value="">Logo tal cual</option><option value="negro">Quitar fondo negro</option><option value="blanco">Quitar fondo blanco</option></select>' +
          '<p class="tm-state" id="tmState"></p></section>' +
        '<section><h3>Colores</h3>' + COLORES.map(row).join('') + '</section>' +
        '<section><h3>Títulos</h3>' +
          '<label class="tm-row"><span>Tamaño</span><input type="range" min="0.8" max="1.6" step="0.05" data-k="escala"><output id="tmEsc"></output></label>' +
          '<label class="tm-row"><span>Brillo</span><input type="range" min="0" max="40" step="1" data-k="brillo"><output id="tmGlow"></output></label></section>' +
        '<section><h3>Fondos laterales</h3><p class="tm-hint">Se ven en pantallas de más de 1560px. En «Previsualizar» puedes arrastrarlos y hacer zoom con la rueda.</p>' +
          side('izq', 'Izquierdo') + side('der', 'Derecho') +
          '<label class="tm-row"><span>Oscurecer</span><input type="range" min="0" max="1" step="0.05" data-k="oscuro"><output id="tmDark"></output></label>' +
          '<label class="tm-chk"><input type="checkbox" data-k="repetir"> Repetir imagen</label>' +
          '<button type="button" class="tm-btn tm-btn--wide" data-act="shots">📷 Usar capturas del juego asociado</button></section>' +
        '<section><h3>Programación</h3>' +
          '<label class="tm-row tm-row--col"><span>Empieza</span><input type="datetime-local" class="tm-in" data-k="desde"></label>' +
          '<label class="tm-row tm-row--col"><span>Termina</span><input type="datetime-local" class="tm-in" data-k="hasta"></label>' +
          '<label class="tm-row"><span>Prioridad</span><input type="number" class="tm-in tm-num" data-k="prioridad" step="1"></label>' +
          '<label class="tm-chk"><input type="checkbox" data-k="confeti"> Confeti al entrar</label>' +
          '<p class="tm-hint">Sin fechas se queda como borrador. Si coinciden varios, gana el de más prioridad.</p></section>' +
      '</div>' +
      '<footer class="tm-foot"><button type="button" class="tm-btn tm-btn--danger" data-act="del">Borrar</button><button type="button" class="tm-btn" data-act="dup">Duplicar</button><button type="button" class="tm-btn" data-act="preview">👁 Previsualizar</button><button type="button" class="tm-btn tm-btn--ok" data-act="save">Guardar</button></footer>';
    document.body.appendChild(panel);
    document.body.insertAdjacentHTML('beforeend', '<div class="tm-back" id="tmBack" hidden><span>Vista previa · arrastra los laterales para moverlos, rueda para zoom</span><button type="button" class="tm-btn tm-btn--ok">✏️ Volver al editor</button></div>');
    document.getElementById('tmBack').addEventListener('click', function (e) { if (e.target.closest('button')) preview(false); });
    initDrag();

    panel.querySelector('#tmGames').innerHTML = GT.Biblioteca.getAll().map(function (g) { return '<option value="' + esc(g.titulo) + '">'; }).join('');
    panel.addEventListener('input', onInput);
    panel.addEventListener('change', onInput);
    panel.addEventListener('click', onClick);
    // al tocar los ajustes de un lateral, el panel se aparta al lado contrario para dejarlo a la vista
    var aside = function (e) { var f = e.target.closest('[data-side]'); if (f) flip(f.dataset.side === 'der'); };
    panel.addEventListener('focusin', aside);
    panel.addEventListener('pointerdown', aside);
    try { flip(localStorage.getItem('GT_tm_left') === '1'); } catch (e) {}
    panel.querySelector('#tmList').addEventListener('change', function () {
      var t = temas.filter(function (x) { return x.id === this.value; }, this)[0];
      if (t) edit(JSON.parse(JSON.stringify(t)));
    });
  }

  function renderList() {
    var ids = temas.map(function (t) { return t.id; });
    var opts = temas.concat(ids.indexOf(draft.id) === -1 ? [draft] : []);
    panel.querySelector('#tmList').innerHTML = opts.map(function (t) {
      return '<option value="' + esc(t.id) + '"' + (t.id === draft.id ? ' selected' : '') + '>' + esc(t.nombre || 'Sin nombre') + (ids.indexOf(t.id) === -1 ? ' (sin guardar)' : '') + '</option>';
    }).join('');
    var st = estado(draft), p = panel.querySelector('#tmState');
    p.textContent = st[0]; p.className = 'tm-state tm-state--' + st[1];
  }

  // vuelca el borrador en los controles
  function edit(t) {
    draft = t;
    var q = function (s) { return panel.querySelector(s); };
    var g = t.juegoId && GT.Biblioteca.getById(t.juegoId);
    q('[data-k="nombre"]').value = t.nombre || '';
    q('[data-k="juego"]').value = g ? g.titulo : '';
    q('[data-k="logo"]').value = t.logo || '';
    q('[data-k="logoFondo"]').value = t.logoFondo || '';
    COLORES.forEach(function (k) {
      var v = (t.colores || {})[k[0]], inp = q('[data-c="' + k[0] + '"]');
      inp.value = v || '#808080'; inp.closest('.tm-row').classList.toggle('is-off', !v);
    });
    q('[data-k="escala"]').value = t.titulos.escala; q('[data-k="brillo"]').value = t.titulos.brillo;
    ['izq', 'der'].forEach(function (k) {
      var s = t.fondos[k];
      if (s.x == null) { s.x = 50; s.y = 50; } // temas de antes, con posición fija
      if (s.zoom == null) s.zoom = 100;
      ['url', 'size', 'zoom', 'x', 'y'].forEach(function (p) { q('[data-f="' + k + '.' + p + '"]').value = s[p] == null ? '' : s[p]; });
    });
    q('[data-k="oscuro"]').value = t.fondos.oscuro; q('[data-k="repetir"]').checked = !!t.fondos.repetir;
    q('[data-k="desde"]').value = toLocal(t.desde); q('[data-k="hasta"]').value = toLocal(t.hasta);
    q('[data-k="prioridad"]').value = t.prioridad || 0; q('[data-k="confeti"]').checked = !!t.confeti;
    outputs(); renderList(); apply(draft);
  }
  function outputs() {
    panel.querySelector('#tmEsc').textContent = Math.round(draft.titulos.escala * 100) + '%';
    panel.querySelector('#tmGlow').textContent = draft.titulos.brillo + 'px';
    panel.querySelector('#tmDark').textContent = Math.round(draft.fondos.oscuro * 100) + '%';
    panel.querySelectorAll('output[data-o]').forEach(function (o) {
      var p = o.dataset.o.split('.'), v = draft.fondos[p[0]][p[1]];
      o.textContent = Math.round(v) + '%';
      panel.querySelector('input[data-f="' + o.dataset.o + '"]').value = v;
    });
  }
  // cambia zoom o posición de un lateral (desde los deslizadores o arrastrando)
  function setSide(k, p, v) {
    var s = draft.fondos[k];
    s[p] = Math.max(p === 'zoom' ? 50 : 0, Math.min(p === 'zoom' ? 300 : 100, v));
    if (p === 'zoom' && s.size !== 'zoom') { s.size = 'zoom'; panel.querySelector('[data-f="' + k + '.size"]').value = 'zoom'; }
  }

  function flip(left) {
    panel.classList.toggle('tm-panel--left', left);
    try { localStorage.setItem('GT_tm_left', left ? '1' : '0'); } catch (e) {}
  }

  // vista previa: el panel se esconde y los laterales se pueden arrastrar
  function preview(on) {
    root.classList.toggle('tm-preview', on);
    panel.hidden = on;
    document.getElementById('tmBack').hidden = !on;
  }
  function initDrag() {
    document.querySelectorAll('.r1-side').forEach(function (el) {
      var k = el.classList.contains('r1-side--l') ? 'izq' : 'der', start = null;
      el.addEventListener('pointerdown', function (e) {
        if (!root.classList.contains('tm-preview')) return;
        start = { x: e.clientX, y: e.clientY, sx: draft.fondos[k].x, sy: draft.fondos[k].y };
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', function (e) {
        if (!start) return;
        // arrastrar a la derecha mueve la imagen a la derecha (baja el % de posición)
        setSide(k, 'x', start.sx - (e.clientX - start.x) / el.clientWidth * 100);
        setSide(k, 'y', start.sy - (e.clientY - start.y) / el.clientHeight * 100);
        outputs(); apply(draft);
      });
      el.addEventListener('pointerup', function () { start = null; });
      el.addEventListener('pointercancel', function () { start = null; });
      el.addEventListener('wheel', function (e) {
        if (!root.classList.contains('tm-preview')) return;
        e.preventDefault();
        setSide(k, 'zoom', draft.fondos[k].zoom - e.deltaY * 0.15);
        outputs(); apply(draft);
      }, { passive: false });
    });
  }

  function onInput(e) {
    var el = e.target, k = el.dataset.k, t = draft;
    if (el.dataset.c) { t.colores[el.dataset.c] = el.value; el.closest('.tm-row').classList.remove('is-off'); }
    else if (el.dataset.f) {
      var p = el.dataset.f.split('.');
      if (el.type === 'range') setSide(p[0], p[1], parseFloat(el.value)); else t.fondos[p[0]][p[1]] = el.value.trim();
    }
    else if (k === 'nombre') t.nombre = el.value;
    else if (k === 'logo') t.logo = el.value.trim();
    else if (k === 'logoFondo') t.logoFondo = el.value;
    else if (k === 'juego') { var g = GT.Biblioteca.getAll().filter(function (x) { return x.titulo === el.value; })[0]; t.juegoId = g ? g.id : ''; }
    else if (k === 'escala' || k === 'brillo') t.titulos[k] = parseFloat(el.value);
    else if (k === 'oscuro') t.fondos.oscuro = parseFloat(el.value);
    else if (k === 'repetir') t.fondos.repetir = el.checked;
    else if (k === 'desde' || k === 'hasta') t[k] = el.value ? new Date(el.value).getTime() : null;
    else if (k === 'prioridad') t.prioridad = parseInt(el.value, 10) || 0;
    else if (k === 'confeti') t.confeti = el.checked;
    else return;
    outputs();
    if (k === 'nombre' || k === 'desde' || k === 'hasta' || k === 'prioridad') renderList();
    apply(t);
  }

  function onClick(e) {
    var b = e.target.closest('[data-act],[data-clear],[data-pick]');
    if (!b) return;
    if (b.dataset.pick) {
      new EyeDropper().open().then(function (r) {
        var inp = panel.querySelector('[data-c="' + b.dataset.pick + '"]');
        inp.value = r.sRGBHex.slice(0, 7);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }).catch(function () {}); // Esc cancela
      return;
    }
    if (b.dataset.clear) { delete draft.colores[b.dataset.clear]; b.closest('.tm-row').classList.add('is-off'); apply(draft); return; }
    var act = b.dataset.act;
    if (act === 'close') close();
    else if (act === 'preview') preview(true);
    else if (act === 'flip') flip(!panel.classList.contains('tm-panel--left'));
    else if (act === 'new') edit(nuevo());
    else if (act === 'dup') { var c = JSON.parse(JSON.stringify(draft)); c.id = nuevo().id; c.nombre += ' (copia)'; c.desde = c.hasta = null; edit(c); }
    else if (act === 'save') save(draft);
    else if (act === 'del') del(draft);
    else if (act === 'shots') fillShots();
  }

  function store(list, msg) {
    return GT.db.collection('settings').doc('temas').set({ lista: list }).then(function () {
      GT.Toast && GT.Toast.show(msg, 'success');
    }).catch(function (err) { GT.Toast && GT.Toast.show('No se pudo guardar: ' + err.message, 'error'); });
  }
  function save(t) {
    if (t.desde && t.hasta && t.hasta <= t.desde) { GT.Toast && GT.Toast.show('La fecha de fin tiene que ser después del inicio', 'error'); return; }
    var copy = JSON.parse(JSON.stringify(t));
    var list = temas.filter(function (x) { return x.id !== t.id; }).concat([copy]);
    store(list, 'Tema guardado');
  }
  function del(t) {
    if (!temas.some(function (x) { return x.id === t.id; })) { edit(temas[0] ? JSON.parse(JSON.stringify(temas[0])) : nuevo()); return; }
    if (!confirm('¿Borrar el tema «' + t.nombre + '»?')) return;
    var list = temas.filter(function (x) { return x.id !== t.id; });
    store(list, 'Tema borrado').then(function () { edit(list[0] ? JSON.parse(JSON.stringify(list[0])) : nuevo()); });
  }

  // capturas del juego en RAWG para los dos laterales
  function fillShots() {
    var g = draft.juegoId && GT.Biblioteca.getById(draft.juegoId);
    if (!g || !GT.Rawg) { GT.Toast && GT.Toast.show('Elige antes el juego asociado', 'error'); return; }
    GT.Rawg.search(g.titulo, 5).then(function (res) {
      var hit = res.filter(function (r) { return r.released === g.fechaLanzamiento; })[0] || res[0];
      var list = ((hit && hit.short_screenshots) || []).map(function (s) { return s.image; }).filter(function (u) { return u !== (hit && hit.background_image); });
      if (!list.length) { GT.Toast && GT.Toast.show('RAWG no tiene capturas de este juego', 'error'); return; }
      list = list.map(function (u) { return GT.Utils.thumb(u, 1280); });
      draft.fondos.izq.url = list[0]; draft.fondos.der.url = list[1] || list[0];
      panel.querySelector('[data-f="izq.url"]').value = draft.fondos.izq.url;
      panel.querySelector('[data-f="der.url"]').value = draft.fondos.der.url;
      apply(draft);
    }).catch(function () { GT.Toast && GT.Toast.show('No se pudo consultar RAWG', 'error'); });
  }

  /* ── ARRANQUE ───────────────────────────────────────────── */
  try { temas = JSON.parse(localStorage.getItem(CACHE)) || []; } catch (e) { temas = []; }
  schedule(); // el último tema conocido, sin esperar a Firebase

  GT.db.collection('settings').doc('temas').onSnapshot(function (doc) { load(doc.exists ? doc.data().lista : []); }, function () {});

  var wantOpen = function () { if (location.hash === '#editor') GT.onDataReady(open); };
  window.addEventListener('hashchange', wantOpen);
  wantOpen();
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) { e.preventDefault(); GT.onDataReady(editing ? close : open); }
    else if (e.key === 'Escape' && editing && !document.querySelector('.modal-overlay.open')) { if (root.classList.contains('tm-preview')) preview(false); else close(); }
  });
  var btn = document.getElementById('tmOpen');
  if (btn) btn.addEventListener('click', function () { GT.onDataReady(open); });
})();
