/* ============================================================
   MEDIA TRACKER — Favoritos (del jugador, todas las categorías)
   Version: 20260712a
   ============================================================ */
(function () {
  'use strict';

  var _items = [];
  var _unsub = null;
  var CATS = [['peliculas', '🎬 Películas'], ['series', '📺 Series'], ['anime', '🌸 Anime']];

  function U() { return window.MT.Utils; }
  function esc(s) { return U().escHtml(s); }
  function player() { return window.MT.getPlayer(); }
  function isFav(it, p) { return !!(it.jugadores && it.jugadores[p] && it.jugadores[p].fav); }

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  function init() {
    waitForMT(load);
    window.addEventListener('mt:catChange', function () { render(); });
  }

  function load() {
    var db = window.MT.getDb();
    if (_unsub) _unsub();
    _unsub = db.collection('mt_items').onSnapshot(function (snap) {
      _items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      render();
      window.MT.hideLoading();
    }, function (e) { console.error('favoritos:', e); window.MT.hideLoading(); });
  }

  function render() {
    var host = document.getElementById('favGrid');
    if (!host) return;
    var p = player();
    var favs = _items.filter(function (it) { return isFav(it, p); });
    document.getElementById('pageCount').textContent = favs.length + ' favorito' + (favs.length !== 1 ? 's' : '') + ' · ' + p;

    if (!favs.length) {
      host.innerHTML =
        '<div class="mt-empty"><div class="mt-empty__icon">⭐</div>' +
        '<div class="mt-empty__title">Sin favoritos todavía</div>' +
        '<p>Pulsa la ⭐ de un título en tu <strong>Registro</strong> o <strong>Biblioteca</strong> para añadirlo aquí.</p></div>';
      return;
    }

    host.innerHTML = CATS.map(function (c) {
      var list = favs.filter(function (it) { return it.tipo === c[0]; })
        .sort(function (a, b) { return (a.titulo || '').localeCompare(b.titulo || '', 'es'); });
      if (!list.length) return '';
      return '<div class="mt-section-header"><span class="mt-section-header__label">' + c[1] +
        '</span><span class="mt-section-header__count">' + list.length + '</span></div>' +
        '<div class="mt-grid">' + list.map(card).join('') + '</div>';
    }).join('');
  }

  function card(it) {
    var u = U(), p = player();
    var nota   = u.resolvePlayerNota(it, p);
    var estado = u.resolvePlayerEstado(it, p);
    var color  = nota !== null ? u.notaColor(nota) : null;
    var sc     = estado ? u.statusClass(estado) : 'sinregistrar';
    var id     = it.id.replace(/'/g, "\\'");
    var cover  = it.portadaUrl
      ? '<img src="' + esc(it.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="mt-card__cover-ph">' + u.catEmoji(it.tipo) + '</div>';
    var scoreBadge = nota !== null ? '<div class="mt-card__score" style="color:' + color + '">' + u.formatNota(nota) + '</div>' : '';
    var starBtn = '<button class="mt-card__fav mt-card__fav--on" title="Quitar de favoritos" onclick="event.stopPropagation();window.MTFav._toggle(\'' + id + '\')">★</button>';
    var genre = it.generos && it.generos[0] ? '<span class="mt-card__genre">' + esc(it.generos[0]) + '</span>' : '';

    return '<div class="mt-card" onclick="window.location.href=\'mt-biblioteca.html?cat=' + it.tipo + '&open=' + encodeURIComponent(it.id) + '\'">' +
      '<div class="mt-card__cover">' + cover + starBtn + scoreBadge + '</div>' +
      '<div class="mt-card__body"><div class="mt-card__title">' + esc(it.titulo) + '</div>' +
        '<div class="mt-card__meta">' + ((it.anio || it['año']) ? '<span class="mt-card__year">' + (it.anio || it['año']) + '</span>' : '') + genre + '</div>' +
        '<div class="mt-card__reg-status mt-status--' + sc + '">' + esc(estado || 'Sin registrar') + '</div>' +
      '</div></div>';
  }

  function toggleFav(id) {
    var it = _items.find(function (x) { return x.id === id; });
    if (!it) return;
    var p = player();
    var existing = (it.jugadores && it.jugadores[p]) || {};
    var payload = { estado: existing.estado || '', nota: (existing.nota !== undefined ? existing.nota : null), fav: false };
    if (!it.jugadores) it.jugadores = {};
    it.jugadores[p] = payload;
    render();
    var upd = {};
    upd['jugadores.' + p] = payload;
    window.MT.getDb().collection('mt_items').doc(id).update(upd).catch(function (e) { console.error('toggleFav:', e); });
  }

  window.MTFav = { _toggle: toggleFav };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
