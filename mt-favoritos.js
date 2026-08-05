/* ============================================================
   MEDIA TRACKER — Favoritos (por jugador y categoría)
   Version: 20260713a
   ============================================================ */
(function () {
  'use strict';

  var _items  = [];
  var _unsub  = null;
  var _player = 'Javi';

  function U() { return window.MT.Utils; }
  function esc(s) { return U().escHtml(s); }
  function isFav(it, p) { return !!(it.jugadores && it.jugadores[p] && it.jugadores[p].fav); }

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  function init() {
    _player = (window.MT && window.MT.getPlayer && window.MT.getPlayer()) || 'Javi';
    waitForMT(load);

    document.querySelectorAll('.mt-psel__card').forEach(function (card) {
      card.addEventListener('click', function () {
        _player = this.dataset.player;
        updateSel();
        render();
      });
    });
    updateSel();

    window.addEventListener('mt:catChange', function () { render(); });
  }

  function updateSel() {
    document.querySelectorAll('.mt-psel__card').forEach(function (c) {
      c.classList.toggle('mt-psel__card--active', c.dataset.player === _player);
    });
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
    var p = _player, cat = window.MT.getCat();
    var favs = _items.filter(function (it) { return it.tipo === cat && isFav(it, p); })
      .sort(function (a, b) { return (a.titulo || '').localeCompare(b.titulo || '', 'es'); });

    document.getElementById('pageCount').textContent =
      favs.length + ' favorito' + (favs.length !== 1 ? 's' : '') + ' · ' + p + ' · ' + U().catLabel(cat);

    if (!favs.length) {
      host.innerHTML =
        '<div class="mt-empty"><div class="mt-empty__icon">⭐</div>' +
        '<div class="mt-empty__title">Sin favoritos aquí</div>' +
        '<p>Pulsa la ⭐ de un título (' + U().catLabel(cat) + ') en tu Registro o Biblioteca.</p></div>';
      return;
    }
    host.innerHTML = '<div class="mt-grid">' + favs.map(card).join('') + '</div>';
  }

  function card(it) {
    var u = U(), p = _player;
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
    var p = _player;
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
