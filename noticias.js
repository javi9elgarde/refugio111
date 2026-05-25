/* ============================================================
   GAMETRACKER — Noticias Page
   Noticias manuales guardadas en Firestore + extracción OG
   ============================================================ */
(function () {
  'use strict';

  /* ── Estado ──────────────────────────────────────────────── */
  var _noticias    = [];   /* array de docs de Firestore        */
  var _featuredId  = null; /* id de la noticia destacada actual */
  var _editingId   = null; /* id en edición (null = nueva)      */
  var _db          = null;

  /* ── Proxy para extracción de OG ───────────────────────────
     allorigins.win devuelve el HTML de cualquier URL pública  */
  var OG_PROXY = 'https://api.allorigins.win/raw?url=';

  /* ── Detección de fuente por dominio ─────────────────────── */
  var SOURCE_MAP = {
    'vandal.elespanol.com':  'Vandal',
    'eurogamer.es':          'Eurogamer España',
    '3djuegos.com':          '3DJuegos',
    'hobbyconsolas.com':     'HobbyConsolas',
    'meristation.com':       'Meristation',
    'as.com':                'AS / Meristation',
    'es.ign.com':            'IGN España',
    'ign.com':               'IGN',
    'kotaku.com':            'Kotaku',
    'gamespot.com':          'GameSpot',
    'eurogamer.net':         'Eurogamer',
    'pcgamer.com':           'PC Gamer',
    'rockpapershotgun.com':  'Rock Paper Shotgun',
    'gamesradar.com':        'GamesRadar',
    'destructoid.com':       'Destructoid',
    'areajugones.com':       'AreaJugones',
    'xataka.com':            'Xataka'
  };

  function detectSource(url) {
    try {
      var host = new URL(url).hostname.replace(/^www\./, '');
      if (SOURCE_MAP[host]) return SOURCE_MAP[host];
      /* Si no está en el mapa, usar el dominio limpio */
      return host.split('.').slice(0, -1).join('.');
    } catch (e) { return ''; }
  }

  /* ── Utilidades ──────────────────────────────────────────── */
  function escHtml(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* Decodifica TODAS las entidades HTML (&#34; &quot; &amp; etc.)
     usando el propio parser del DOM — no hay regex que las cubra todas */
  function decodeEntities(str) {
    if (!str) return '';
    var el = document.createElement('textarea');
    el.innerHTML = str;
    return el.value;
  }

  function formatDate(str) {
    if (!str) return '';
    try {
      var d = new Date(str + 'T12:00:00');
      if (isNaN(d)) return str;
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return str; }
  }

  /* ── Extracción de metadatos OG ──────────────────────────── */
  function fetchOgData(url, onSuccess, onError) {
    var proxyUrl = OG_PROXY + encodeURIComponent(url);
    fetch(proxyUrl, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        /* og:title */
        var ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,300})/i)
                  || html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+property=["']og:title["']/i);
        /* og:image */
        var ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
                  || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        /* <title> fallback */
        var titleTag = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
        /* twitter:image fallback */
        var twImage = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i)
                   || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

        var title = (ogTitle  && ogTitle[1].trim())  || (titleTag && titleTag[1].trim()) || '';
        var image = (ogImage  && ogImage[1].trim())  || (twImage  && twImage[1].trim())  || '';

        /* Hacer URL de imagen absoluta */
        if (image && image.indexOf('http') !== 0) {
          try {
            var base = new URL(url);
            image = image.indexOf('//') === 0
              ? base.protocol + image
              : base.origin + (image.indexOf('/') === 0 ? '' : '/') + image;
          } catch (e) {}
        }

        /* Decodificar TODAS las entidades HTML del título (&#34; &quot; etc.) */
        title = decodeEntities(title);

        onSuccess({ title: title, image: image });
      })
      .catch(function (err) { onError(err.message || 'Error de red'); });
  }

  /* ── Render: grid de tarjetas ────────────────────────────── */
  function renderGrid() {
    var grid  = document.getElementById('newsGrid');
    var empty = document.getElementById('newsEmpty');
    if (!grid) return;

    if (!_noticias.length) {
      if (empty) empty.style.display = 'flex';
      grid.innerHTML = '';
      grid.appendChild(empty);
      return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = _noticias.map(function (n) {
      return renderCard(n);
    }).join('');

    /* Listeners */
    grid.querySelectorAll('.news-star-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        featureNoticia(this.dataset.id);
      });
    });
    grid.querySelectorAll('.news-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteNoticia(this.dataset.id);
      });
    });
    grid.querySelectorAll('.news-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditModal(this.dataset.id);
      });
    });
  }

  function renderCard(n) {
    var isFeatured = n.id === _featuredId;
    var img = n.imagen || '';
    var date = formatDate(n.fecha || '');

    return '<div class="news-card' + (isFeatured ? ' news-card--featured' : '') + '">' +

      /* Imagen 16:9 — clicar abre la URL */
      '<a href="' + escHtml(n.url) + '" target="_blank" rel="noopener noreferrer" class="news-card__img-wrap">' +
        (img
          ? '<img src="' + escHtml(img) + '" class="news-card__img" alt="" loading="lazy" onerror="this.parentElement.classList.add(\'news-card__img-wrap--ph\')">'
          : '') +
        '<div class="news-card__img-ph' + (img ? ' news-card__img-ph--hidden' : '') + '"><span>📰</span></div>' +
        (n.fuente ? '<div class="news-card__source-badge">' + escHtml(n.fuente) + '</div>' : '') +
        (isFeatured ? '<div class="news-card__featured-badge">⭐ DESTACADA</div>' : '') +
      '</a>' +

      /* Cuerpo */
      '<div class="news-card__body">' +
        (date ? '<div class="news-card__date">' + escHtml(date) + '</div>' : '') +
        '<a href="' + escHtml(n.url) + '" target="_blank" rel="noopener noreferrer" class="news-card__title-link">' +
          '<h3 class="news-card__title">' + escHtml(decodeEntities(n.titulo)) + '</h3>' +
        '</a>' +
        '<div class="news-card__footer">' +
          '<a href="' + escHtml(n.url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Leer →</a>' +
          '<div class="news-card__actions">' +
            '<button class="news-star-btn' + (isFeatured ? ' news-star-btn--active' : '') + '" data-id="' + n.id + '" title="' + (isFeatured ? 'Quitar de destacada' : 'Destacar en inicio') + '">' +
              (isFeatured ? '⭐' : '☆') +
            '</button>' +
            '<button class="news-edit-btn" data-id="' + n.id + '" title="Editar">✏️</button>' +
            '<button class="news-delete-btn" data-id="' + n.id + '" title="Eliminar">🗑️</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Destacar / quitar destacada ─────────────────────────── */
  function featureNoticia(id) {
    if (!_db) return;
    var noticia = _noticias.find(function (n) { return n.id === id; });
    if (!noticia) return;

    if (_featuredId === id) {
      /* Quitar destacada */
      _db.collection('settings').doc('featuredNews').delete()
        .then(function () {
          _featuredId = null;
          renderGrid();
          renderFeaturedBanner(null);
          if (window.GT && window.GT.Toast) window.GT.Toast.show('Noticia eliminada del inicio');
        });
    } else {
      /* Destacar nueva */
      var data = {
        title:   noticia.titulo  || '',
        img:     noticia.imagen  || '',
        url:     noticia.url     || '',
        source:  noticia.fuente  || '',
        pubDate: noticia.fecha   || '',
        excerpt: ''
      };
      _db.collection('settings').doc('featuredNews').set(data)
        .then(function () {
          _featuredId = id;
          renderGrid();
          renderFeaturedBanner(data);
          if (window.GT && window.GT.Toast) window.GT.Toast.show('⭐ Noticia destacada en el inicio');
        });
    }
  }

  /* ── Eliminar noticia ─────────────────────────────────────── */
  function deleteNoticia(id) {
    if (!_db) return;
    if (!confirm('¿Eliminar esta noticia?')) return;
    /* Si era la destacada, limpiar también */
    if (_featuredId === id) {
      _db.collection('settings').doc('featuredNews').delete().catch(function () {});
    }
    _db.collection('noticias').doc(id).delete()
      .catch(function () {
        if (window.GT && window.GT.Toast) window.GT.Toast.show('Error al eliminar', 'error');
      });
  }

  /* ── Banner destacada ─────────────────────────────────────── */
  function renderFeaturedBanner(data) {
    var banner = document.getElementById('featuredNewsBanner');
    if (!banner) return;
    if (!data || !data.title) { banner.style.display = 'none'; return; }
    banner.style.display = '';
    banner.innerHTML =
      '<a href="' + escHtml(data.url) + '" target="_blank" rel="noopener noreferrer" class="news-featured-inner">' +
        (data.img
          ? '<div class="news-featured__img-wrap"><img src="' + escHtml(data.img) + '" class="news-featured__img" alt=""></div>'
          : '') +
        '<div class="news-featured__body">' +
          '<div class="news-featured__label">⭐ Noticia Destacada en Inicio</div>' +
          '<h2 class="news-featured__title">' + escHtml(decodeEntities(data.title)) + '</h2>' +
          (data.source
            ? '<div class="news-featured__meta">' + escHtml(data.source) + (data.pubDate ? ' · ' + formatDate(data.pubDate) : '') + '</div>'
            : '') +
        '</div>' +
      '</a>';
  }

  /* ── Modal: abrir nueva noticia ──────────────────────────── */
  function openNewModal() {
    _editingId = null;
    document.getElementById('newsModalTitle').textContent = '📰 Nueva Noticia';
    document.getElementById('nUrl').value    = '';
    document.getElementById('nTitulo').value = '';
    document.getElementById('nImagen').value = '';
    document.getElementById('nFuente').value = '';
    document.getElementById('nFecha').value  = new Date().toISOString().slice(0, 10);
    updateImgPreview('');
    setFetchStatus('', false);
    document.getElementById('newsModalOverlay').style.display = 'flex';
    document.getElementById('nUrl').focus();
  }

  /* ── Modal: abrir edición ────────────────────────────────── */
  function openEditModal(id) {
    var n = _noticias.find(function (x) { return x.id === id; });
    if (!n) return;
    _editingId = id;
    document.getElementById('newsModalTitle').textContent = '✏️ Editar Noticia';
    document.getElementById('nUrl').value    = n.url    || '';
    document.getElementById('nTitulo').value = n.titulo || '';
    document.getElementById('nImagen').value = n.imagen || '';
    document.getElementById('nFuente').value = n.fuente || '';
    document.getElementById('nFecha').value  = n.fecha  || '';
    updateImgPreview(n.imagen || '');
    setFetchStatus('', false);
    document.getElementById('newsModalOverlay').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('newsModalOverlay').style.display = 'none';
    _editingId = null;
  }

  /* ── Modal: preview imagen en tiempo real ────────────────── */
  function updateImgPreview(url) {
    var preview = document.getElementById('newsImgPreview');
    var ph      = document.getElementById('newsImgPreviewPh');
    if (!preview || !ph) return;
    if (url) {
      preview.src = url;
      preview.style.display = 'block';
      ph.style.display = 'none';
    } else {
      preview.src = '';
      preview.style.display = 'none';
      ph.style.display = 'flex';
    }
  }

  function setFetchStatus(msg, isError) {
    var el = document.getElementById('fetchStatus');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = 'block';
    el.textContent   = msg;
    el.className     = 'news-fetch-status' + (isError ? ' news-fetch-status--error' : ' news-fetch-status--ok');
  }

  /* ── Modal: obtener datos OG ─────────────────────────────── */
  function handleFetchOg() {
    var url = document.getElementById('nUrl').value.trim();
    if (!url || url.indexOf('http') !== 0) {
      setFetchStatus('⚠️ Introduce una URL válida (comienza por http…)', true);
      return;
    }
    var btn = document.getElementById('btnFetchOg');
    btn.disabled    = true;
    btn.textContent = '⏳ Obteniendo...';
    setFetchStatus('', false);

    fetchOgData(url,
      function (data) {
        btn.disabled    = false;
        btn.textContent = '🔍 Obtener datos';
        if (data.title) document.getElementById('nTitulo').value = data.title;
        if (data.image) {
          document.getElementById('nImagen').value = data.image;
          updateImgPreview(data.image);
        }
        /* Auto-detectar fuente */
        var fuente = document.getElementById('nFuente');
        if (!fuente.value) fuente.value = detectSource(url);

        var msg = '✓ Datos obtenidos';
        if (!data.title && !data.image) msg = '⚠️ No se encontraron metadatos — rellena a mano';
        setFetchStatus(msg, !data.title && !data.image);
      },
      function (errMsg) {
        btn.disabled    = false;
        btn.textContent = '🔍 Obtener datos';
        setFetchStatus('⚠️ No se pudo acceder: ' + errMsg + ' — rellena los campos a mano', true);
        /* Rellenar fuente aunque haya fallado */
        var fuente = document.getElementById('nFuente');
        if (!fuente.value) fuente.value = detectSource(url);
      }
    );
  }

  /* ── Modal: guardar noticia ──────────────────────────────── */
  function handleSave() {
    var url    = document.getElementById('nUrl').value.trim();
    var titulo = document.getElementById('nTitulo').value.trim();
    var imagen = document.getElementById('nImagen').value.trim();
    var fuente = document.getElementById('nFuente').value.trim();
    var fecha  = document.getElementById('nFecha').value;

    if (!url)    { alert('El enlace es obligatorio'); return; }
    if (!titulo) { alert('El titular es obligatorio'); return; }

    var data = {
      url:     url,
      titulo:  titulo,
      imagen:  imagen,
      fuente:  fuente,
      fecha:   fecha,
      addedAt: new Date().toISOString()
    };

    var btn = document.getElementById('btnSaveNewsModal');
    btn.disabled = true; btn.textContent = '💾 Guardando...';

    var promise = _editingId
      ? _db.collection('noticias').doc(_editingId).update(data)
      : _db.collection('noticias').add(data);

    promise
      .then(function () {
        btn.disabled = false; btn.textContent = '💾 Guardar';
        closeModal();
        if (window.GT && window.GT.Toast) window.GT.Toast.show('Noticia guardada ✓');
        /* Si estamos editando la noticia destacada, actualizar también settings */
        if (_editingId && _editingId === _featuredId) {
          _db.collection('settings').doc('featuredNews').update({
            title:  titulo,
            img:    imagen,
            source: fuente,
            pubDate: fecha
          }).catch(function () {});
        }
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = '💾 Guardar';
        if (window.GT && window.GT.Toast) window.GT.Toast.show('Error al guardar', 'error');
      });
  }

  /* ── Cargar featured desde Firestore ─────────────────────── */
  function loadFeatured() {
    _db.collection('settings').doc('featuredNews').onSnapshot(function (doc) {
      if (doc.exists && doc.data().url) {
        var data = doc.data();
        /* Buscar la noticia local por URL para obtener el id */
        var match = _noticias.find(function (n) { return n.url === data.url; });
        _featuredId = match ? match.id : null;
        renderFeaturedBanner(data);
      } else {
        _featuredId = null;
        renderFeaturedBanner(null);
      }
      renderGrid();
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  function waitForDb(cb) {
    if (window.GT && window.GT.db) { _db = window.GT.db; return cb(); }
    setTimeout(function () { waitForDb(cb); }, 100);
  }

  document.addEventListener('DOMContentLoaded', function () {

    /* Preview imagen en tiempo real al escribir URL de imagen */
    var nImagenInput = document.getElementById('nImagen');
    if (nImagenInput) {
      nImagenInput.addEventListener('input', function () {
        updateImgPreview(this.value.trim());
      });
    }

    /* Botones del modal */
    document.getElementById('btnNuevaNoticia').addEventListener('click', openNewModal);
    document.getElementById('btnCloseNewsModal').addEventListener('click', closeModal);
    document.getElementById('btnCancelNewsModal').addEventListener('click', closeModal);
    document.getElementById('btnSaveNewsModal').addEventListener('click', handleSave);
    document.getElementById('btnFetchOg').addEventListener('click', handleFetchOg);

    /* Cerrar al clicar fuera */
    document.getElementById('newsModalOverlay').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });

    /* Enter en la URL lanza el fetch */
    document.getElementById('nUrl').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleFetchOg();
    });

    /* Ocultar loading overlay */
    var overlay = document.getElementById('gtLoading');
    if (overlay) {
      setTimeout(function () {
        overlay.style.transition = 'opacity 0.4s';
        overlay.style.opacity = '0';
        setTimeout(function () { overlay.style.display = 'none'; }, 420);
      }, 600);
    }

    /* Arrancar con Firestore */
    waitForDb(function () {
      /* Escuchar la colección 'noticias' en tiempo real */
      _db.collection('noticias').orderBy('addedAt', 'desc').onSnapshot(function (snap) {
        _noticias = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        renderGrid();
      }, function () {
        /* Si falla orderBy (índice no creado), intentar sin orden */
        _db.collection('noticias').onSnapshot(function (snap) {
          _noticias = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
          _noticias.sort(function (a, b) {
            return (b.addedAt || '').localeCompare(a.addedAt || '');
          });
          renderGrid();
        });
      });

      loadFeatured();
    });
  });

})();
