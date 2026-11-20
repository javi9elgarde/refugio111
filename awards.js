/* ============================================================
   REFUGIO 111 — VAULTY Awards: las votaciones del Refugio, como The Game Awards
   · Papeleta de cada año en vaulty-awards.js; votos en Firestore:
       vaultyAwards/{año} = { votos: { David: { goty: 2, … }, … }, imgs: { clave: url } }
   · Cada jugador vota uno por categoría (y puede cambiarlo). Los votos de los demás se ven
     cuando ya has votado esa categoría; con los tres votos, sale el ganador.
   · Los juegos que están en la Biblioteca salen con su portada y abren su ficha; los demás
     toman una imagen de IGDB (o de TMDB, en cine y series) que se guarda para la próxima vez.
   ============================================================ */
(function () {
  'use strict';

  var GT = window.GT, DATA = window.VAULTY_AWARDS || {};
  var PLAYERS = ['David', 'Javi', 'Mery'];
  var COLOR = { David: '#60a5fa', Javi: '#f87171', Mery: '#c084fc' };
  var IGDB = 'https://refugio111-igdb.javi9play3.workers.dev/search?limit=1&q=';
  var TMDB = 'https://api.themoviedb.org/3/search/multi?api_key=2a0181b8eb1bb888042a00f91e10681c&language=es-ES&query=';
  var year = null, doc = { votos: {}, imgs: {} }, unsub = null, modal, opener;

  function esc(t) { return GT.Utils.escapeHtml(t == null ? '' : String(t)); }
  function me() { var p = GT.getActivePlayer && GT.getActivePlayer(); return PLAYERS.indexOf(p) >= 0 ? p : null; }
  function years() { return Object.keys(DATA).map(Number).sort(function (a, b) { return b - a; }); }
  function key(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function ref() { return GT.db.collection('vaultyAwards').doc(String(year)); }

  // el juego de la Biblioteca que corresponde a un nominado (mismo nombre, sin fijarse en tildes ni símbolos)
  var _lib = {};
  function libGame(title) {
    var k = key(title);
    if (k in _lib) return _lib[k];
    var best = null, score = 0;
    GT.Biblioteca.getAll().forEach(function (g) {
      var s = window.GT_CoopMatch ? GT_CoopMatch.score(title, g.titulo) : (key(g.titulo) === k ? 1 : 0);
      if (s > score) { score = s; best = g; }
    });
    if (score < 0.99) best = numbered(title);
    return (_lib[k] = best);
  }
  // «Resident Evil Requiem» = «Resident Evil 9: Requiem»: mismas palabras, y en la Biblioteca solo sobra el número de la saga
  function numbered(title) {
    if (!window.GT_CoopMatch) return null;
    var w = GT_CoopMatch.norm(title).split(' ');
    return GT.Biblioteca.getAll().filter(function (g) {
      var gw = GT_CoopMatch.norm(g.titulo).split(' ');
      var extra = gw.filter(function (x) { return w.indexOf(x) === -1; });
      return w.every(function (x) { return gw.indexOf(x) !== -1; }) && extra.length && extra.every(function (x) { return /^\d+$/.test(x); });
    })[0] || null;
  }
  function nomGame(n) { return n.juego || n.t; }
  // el juego de la Biblioteca de un nominado; las películas y series (tipo 'media') nunca son de la Biblioteca
  function gameFor(n, cat) { return cat.tipo === 'media' ? null : libGame(nomGame(n)); }
  function image(n, cat) {
    var g = gameFor(n, cat);
    if (g && g.portadaUrl) return GT.Utils.thumb(g.portadaUrl, 640);
    return doc.imgs[key(nomGame(n))] || '';
  }

  /* ── imágenes de los que no están en la Biblioteca (una vez, y se guardan) ── */
  var fetching = {};
  function fetchImages() {
    var todo = [];
    (DATA[year] || []).forEach(function (cat) {
      cat.nominados.forEach(function (n) {
        var t = nomGame(n), k = key(t);
        if (gameFor(n, cat) || doc.imgs[k] || fetching[k]) return;
        fetching[k] = true;
        todo.push({ t: t, k: k, media: cat.tipo === 'media' });
      });
    });
    var found = {}, i = 0;
    function next() {
      var it = todo[i++];
      if (!it) return Promise.resolve();
      var q = it.media
        ? fetch(TMDB + encodeURIComponent(it.t.replace(/\s*(temporada|season)\s*\d+\s*$/i, ''))).then(function (r) { return r.json(); }).then(function (d) {
            var x = (d.results || []).filter(function (r) { return r.backdrop_path || r.poster_path; })[0];
            return x ? 'https://image.tmdb.org/t/p/w780' + (x.backdrop_path || x.poster_path) : '';
          })
        : fetch(IGDB + encodeURIComponent(it.t)).then(function (r) { return r.json(); }).then(function (l) { return (l[0] && (l[0].image || l[0].cover)) || ''; });
      return q.catch(function () { return ''; }).then(function (url) {
        if (url) { found[it.k] = url; doc.imgs[it.k] = url; paintImg(it.k, url); }
        return next();
      });
    }
    // de cuatro en cuatro, para no saturar
    return Promise.all([next(), next(), next(), next()]).then(function () {
      if (Object.keys(found).length) ref().set({ imgs: found }, { merge: true }).catch(function () {});
    });
  }
  function paintImg(k, url) {
    modal.querySelectorAll('.aw-nom__img[data-k="' + k + '"]').forEach(function (el) {
      el.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
      el.classList.remove('is-empty');
    });
  }

  /* ── votos ── */
  function votes(catId) {
    var out = {};
    PLAYERS.forEach(function (p) { var v = (doc.votos[p] || {})[catId]; if (v != null) out[p] = v; });
    return out;
  }
  function vote(catId, idx) {
    var p = me();
    if (!p) { GT.Toast && GT.Toast.show('Elige primero quién eres (arriba a la derecha)', 'error'); return; }
    var data = { votos: {} }; data.votos[p] = {}; data.votos[p][catId] = idx;
    doc.votos[p] = doc.votos[p] || {}; doc.votos[p][catId] = idx; // al momento, sin esperar a Firestore
    render();
    ref().set(data, { merge: true }).then(function () { if (GT.haptic) GT.haptic(30); })
      .catch(function (e) { GT.Toast && GT.Toast.show('No se pudo guardar el voto: ' + e.message, 'error'); });
  }

  /* ── pintar ── */
  function face(p) { return '<img class="aw-face" src="cara_' + p.toLowerCase() + '.png" alt="' + p + '" title="Voto de ' + p + '" style="--pc:' + COLOR[p] + '">'; }

  function render() {
    var cats = DATA[year] || [], p = me();
    var mine = p ? Object.keys(doc.votos[p] || {}).length : 0;
    modal.querySelector('#awYear').innerHTML = years().map(function (y) { return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>'; }).join('');
    modal.querySelector('#awProgress').innerHTML =
      (p ? '<span class="aw-me" style="--pc:' + COLOR[p] + '">' + face(p) + ' Votas como <b>' + p + '</b> · ' + mine + ' / ' + cats.length + '</span>'
         : '<span class="aw-me">Elige jugador para votar</span>') +
      PLAYERS.filter(function (x) { return x !== p; }).map(function (x) {
        var n = Object.keys(doc.votos[x] || {}).length;
        return '<span class="aw-chip' + (n >= cats.length ? ' is-done' : '') + '">' + face(x) + n + ' / ' + cats.length + '</span>';
      }).join('');
    modal.querySelector('#awCats').innerHTML = cats.map(function (cat) {
      var v = votes(cat.id), n = Object.keys(v).length, mineV = p ? v[p] : undefined, show = mineV != null || n === PLAYERS.length;
      var count = cat.nominados.map(function (_, i) { return PLAYERS.filter(function (x) { return v[x] === i; }).length; });
      var max = Math.max.apply(null, count), done = n === PLAYERS.length;
      return '<section class="aw-cat' + (mineV != null ? ' is-voted' : '') + '" id="aw-' + cat.id + '">' +
        '<header class="aw-cat__h"><h3><span>' + cat.icono + '</span>' + esc(cat.nombre) + '</h3>' +
          '<small>' + (done ? (count.filter(function (c) { return c === max; }).length > 1 ? '🤝 Empate' : '🏆 Ganador decidido') : mineV != null ? '✓ Ya has votado · ' + n + ' de 3' : p ? 'Falta tu voto' : n + ' de 3 votos') + '</small></header>' +
        '<div class="aw-noms">' + cat.nominados.map(function (nom, i) {
          var img = image(nom, cat), g = gameFor(nom, cat), win = done && count[i] === max;
          var who = show ? PLAYERS.filter(function (x) { return v[x] === i; }) : [];
          return '<button type="button" class="aw-nom' + (mineV === i ? ' is-mine' : '') + (win ? ' is-win' : '') + '" data-cat="' + cat.id + '" data-i="' + i + '"' +
              (p ? ' style="--pc:' + COLOR[p] + '"' : '') + ' aria-pressed="' + (mineV === i) + '">' +
            '<span class="aw-nom__img' + (img ? '' : ' is-empty') + '" data-k="' + key(nomGame(nom)) + '"' + (img ? ' style="background-image:url(\'' + esc(img).replace(/'/g, '%27') + '\')"' : '') + '>' +
              (win ? '<b class="aw-win">🏆 GANADOR</b>' : '') + '</span>' +
            '<span class="aw-nom__t">' + esc(nom.t) + '<small>' + esc(nom.s || '') + '</small></span>' +
            '<span class="aw-nom__f">' + who.map(face).join('') +
              (g ? '<span class="aw-info" role="button" tabindex="0" data-ficha="' + esc(g.id) + '" title="Ver ficha">ⓘ</span>' : '') + '</span>' +
          '</button>';
        }).join('') + '</div></section>';
    }).join('');
  }

  function load(y) {
    year = y; doc = { votos: {}, imgs: {} };
    render();
    if (unsub) unsub();
    unsub = ref().onSnapshot(function (s) {
      var d = s.exists ? s.data() : {};
      doc = { votos: d.votos || {}, imgs: Object.assign({}, doc.imgs, d.imgs || {}) };
      render();
      fetchImages();
    }, function (e) { console.warn('VAULTY Awards:', e); });
  }

  function open() {
    if (!modal.hidden) return;
    modal.hidden = false; document.body.classList.add('honor-open');
    load(year || years()[0]);
    modal.querySelector('#awClose').focus();
  }
  function close() {
    if (modal.hidden) return;
    modal.hidden = true; document.body.classList.remove('honor-open');
    if (unsub) { unsub(); unsub = null; }
    if (location.hash === '#awards') history.replaceState(null, '', location.pathname + location.search);
    if (opener) opener.focus();
  }

  function init() {
    modal = document.getElementById('awardsModal'); opener = document.getElementById('awardsOpen');
    if (!modal || !years().length) return;
    opener.addEventListener('click', open);
    modal.querySelector('#awClose').addEventListener('click', close);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) return close();
      var info = e.target.closest('[data-ficha]');
      if (info) { e.stopPropagation(); GT.GameDetailModal.open(info.dataset.ficha); return; }
      var b = e.target.closest('.aw-nom');
      if (b) vote(b.dataset.cat, parseInt(b.dataset.i, 10));
    });
    modal.querySelector('#awYear').addEventListener('change', function () { load(parseInt(this.value, 10)); });
    document.addEventListener('keydown', function (e) {
      var gd = document.getElementById('gdModal'); // con la ficha abierta, Escape solo cierra la ficha
      if (e.key === 'Escape' && !(gd && getComputedStyle(gd).display !== 'none')) close();
    });
    // desde el cartel del evento (halloffame.html#awards) se abre directamente
    if (location.hash === '#awards') open();
    window.addEventListener('hashchange', function () { if (location.hash === '#awards') open(); });
  }

  document.addEventListener('DOMContentLoaded', function () { GT.onDataReady(init); });
})();
