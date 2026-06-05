/* ============================================================
   MEDIA TRACKER — Registro (actividad reciente)
   Version: 20260605a
   ============================================================ */
(function () {
  'use strict';

  var _items      = [];
  var _unsub      = null;
  var _filterPlayer = 'All';
  var _filterStatus = '';
  var _searchQuery  = '';

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  function init() {
    waitForMT(function () {
      loadItems();
      updatePageMeta();
    });

    document.getElementById('searchInput').addEventListener('input', function () {
      _searchQuery = this.value.toLowerCase();
      renderList();
    });
    document.getElementById('statusFilter').addEventListener('change', function () {
      _filterStatus = this.value; renderList();
    });
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    document.querySelectorAll('input[name="mtPlayer"]').forEach(function (r) {
      r.addEventListener('change', function () {
        _filterPlayer = this.value; renderList();
      });
    });

    window.addEventListener('mt:catChange', function () {
      if (_unsub) _unsub();
      loadItems();
      updatePageMeta();
    });
  }

  function loadItems() {
    var db  = window.MT.getDb();
    var cat = window.MT.getCat();
    if (_unsub) _unsub();
    _unsub = db.collection('mt_items')
      .where('tipo', '==', cat)
      .onSnapshot(function (snap) {
        _items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        /* Ordenar por fecha de añadido, más reciente primero */
        _items.sort(function (a, b) {
          var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
          var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        renderList();
        window.MT.hideLoading();
      }, function (err) {
        console.error('MT registro error:', err);
        window.MT.hideLoading();
      });
  }

  function updatePageMeta() {
    var cat = window.MT.getCat();
    var titles = { peliculas: 'Registro · Películas', series: 'Registro · Series', anime: 'Registro · Anime' };
    document.getElementById('pageTitle').textContent = titles[cat] || 'Registro';
    document.title = 'Refugio 111 — ' + (titles[cat] || 'Registro');
  }

  function filterItems() {
    return _items.filter(function (item) {
      if (_filterPlayer && _filterPlayer !== 'All') {
        var jInfo = item.jugadores && item.jugadores[_filterPlayer];
        if (!jInfo || !jInfo.estado) return false;
      }
      if (_filterStatus) {
        var hasStatus = false;
        if (item.jugadores) {
          Object.values(item.jugadores).forEach(function (j) {
            if (j && j.estado) {
              var sc = MT.Utils.statusClass(j.estado);
              if (sc.indexOf(_filterStatus) >= 0 || _filterStatus.indexOf(sc) >= 0) hasStatus = true;
            }
          });
        }
        if (!hasStatus) return false;
      }
      if (_searchQuery) {
        var hay = [item.titulo, item.director, item.estudio].join(' ').toLowerCase();
        if ((item.generos || []).length) hay += ' ' + item.generos.join(' ').toLowerCase();
        if (hay.indexOf(_searchQuery) < 0) return false;
      }
      return true;
    });
  }

  function clearFilters() {
    _filterPlayer = 'All'; _filterStatus = ''; _searchQuery = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.querySelectorAll('input[name="mtPlayer"]').forEach(function (r) {
      r.checked = r.value === 'All';
    });
    renderList();
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderList() {
    var list  = document.getElementById('mtList');
    var items = filterItems();
    var count = document.getElementById('pageCount');

    count.textContent = items.length + ' título' + (items.length !== 1 ? 's' : '');

    if (items.length === 0) {
      list.innerHTML =
        '<div class="mt-empty">' +
          '<div class="mt-empty__icon">' + window.MT.Utils.catEmoji(window.MT.getCat()) + '</div>' +
          '<div class="mt-empty__title">No se encontraron títulos</div>' +
          '<p>Prueba a cambiar los filtros.</p>' +
        '</div>';
      return;
    }

    list.innerHTML = items.map(renderRow).join('');
  }

  function renderRow(item) {
    var U     = window.MT.Utils;
    var nota  = U.calcNotaMedia(item.jugadores);
    var color = nota !== null ? U.notaColor(nota) : null;

    var cover = item.portadaUrl
      ? '<img src="' + U.escHtml(item.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="mt-reg-row__cover-ph">' + U.catEmoji(item.tipo) + '</div>';

    var scoreBadge = nota !== null
      ? '<div class="mt-reg-row__score" style="color:' + color + '">' + U.formatNota(nota) + '</div>'
      : '';

    var dots = ['David', 'Javi', 'Mery'].map(function (p) {
      var est = item.jugadores && item.jugadores[p] && item.jugadores[p].estado;
      var nota_p = item.jugadores && item.jugadores[p] && item.jugadores[p].nota;
      var dotCls = U.playerDotClass(est);
      return '<div class="mt-reg-row__player">' +
        '<div class="mt-card__dot ' + dotCls + '" title="' + p + ': ' + (est || 'sin estado') + '"></div>' +
        '<span class="mt-reg-row__pname">' + p.charAt(0) + '</span>' +
        (nota_p !== null && nota_p !== undefined && nota_p !== '' ? '<span class="mt-reg-row__pnota" style="color:' + U.notaColor(nota_p) + '">' + U.formatNota(nota_p) + '</span>' : '') +
      '</div>';
    }).join('');

    var genre = item.generos && item.generos[0]
      ? '<span class="mt-badge mt-badge--genre">' + U.escHtml(item.generos[0]) + '</span>'
      : '';

    var dateStr = formatDate(item.createdAt);

    return '<div class="mt-reg-row">' +
      '<div class="mt-reg-row__cover">' + cover + scoreBadge + '</div>' +
      '<div class="mt-reg-row__body">' +
        '<div class="mt-reg-row__title">' + U.escHtml(item.titulo) + '</div>' +
        '<div class="mt-reg-row__meta">' +
          (item.anio || item.año ? '<span class="mt-badge mt-badge--year">' + (item.anio || item.año) + '</span>' : '') +
          genre +
          (item.director ? '<span class="mt-reg-row__dir">' + U.escHtml(item.director) + '</span>' : '') +
          (item.estudio  ? '<span class="mt-reg-row__dir">' + U.escHtml(item.estudio)  + '</span>' : '') +
        '</div>' +
        '<div class="mt-reg-row__players">' + dots + '</div>' +
      '</div>' +
      '<div class="mt-reg-row__date">' + dateStr + '</div>' +
    '</div>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
