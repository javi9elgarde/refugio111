/* ============================================================
   REFUGIO 111 — Chollos: resumen de lo que vigila CholloGarde
   Lee el db.json público de CholloGarde (rama «datos») y enseña, de un vistazo, los juegos con su
   mejor precio, la rebaja frente a la tienda oficial (Steam / PS Store), si ya están por debajo del
   objetivo, la recomendación de la IA y qué tiendas tienen más precios mínimos.
   Los cambios (añadir juegos, objetivos…) se siguen haciendo en CholloGarde.
   ============================================================ */
(function () {
  'use strict';

  var DATA_URL = 'https://raw.githubusercontent.com/javi9elgarde/Chollo-Garde/datos/db.json';
  var CG_URL = 'https://javi9elgarde.github.io/Chollo-Garde/#juegos';
  var CACHE_KEY = 'GT_chollos';
  var AI = {
    COMPRAR_AHORA: { cls: 'buy', txt: '✅ Comprar ya' },
    ESPERAR_BAJADA: { cls: 'wait', txt: '⏳ Esperar bajada' },
    INFLADO: { cls: 'bad', txt: '⚠️ Precio inflado' }
  };

  function $(id) { return document.getElementById(id); }
  function U() { return window.GT.Utils; }
  function esc(t) { return U().escapeHtml(t == null ? '' : String(t)); }
  function eur(n) { return n == null ? '—' : n.toFixed(2).replace('.', ',') + ' €'; }

  function ago(ms) {
    var m = Math.round((Date.now() - ms) / 6e4);
    if (m < 1) return 'ahora mismo';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.round(h / 24);
    return 'hace ' + d + ' día' + (d === 1 ? '' : 's');
  }

  // un juego, ya masticado: tiendas con precio ordenadas, referencia oficial y rebaja
  function game(t) {
    var stores = (t.stores || []).filter(function (s) { return typeof s.price === 'number'; })
      .sort(function (a, b) { return a.price - b.price; });
    var official = (t.stores || []).filter(function (s) { return s.type === 'official'; })[0];
    var ref = (official && (official.initial || official.price)) || t.msrp || null;
    var best = stores[0] || null;
    var price = best ? best.price : (typeof t.current === 'number' ? t.current : null);
    var off = ref && price != null && price < ref ? Math.round((1 - price / ref) * 100) : 0;
    return {
      t: t, stores: stores, best: best, price: price, ref: ref, off: off,
      goal: t.target != null && price != null && price <= t.target,
      img: t.art || t.image || ''
    };
  }

  function spark(hist) {
    var pts = (hist || []).filter(function (h) { return typeof h.p === 'number'; }).slice(-30);
    if (pts.length < 2) return '';
    var min = Math.min.apply(null, pts.map(function (h) { return h.p; })), max = Math.max.apply(null, pts.map(function (h) { return h.p; }));
    var span = max - min || 1, W = 300, H = 38;
    var line = pts.map(function (h, i) { return (i / (pts.length - 1) * W).toFixed(1) + ',' + (H - 4 - (h.p - min) / span * (H - 8)).toFixed(1); }).join(' ');
    var last = pts[pts.length - 1].p, first = pts[0].p, col = last < first ? '#4ade80' : last > first ? '#f87171' : '#94a3b8';
    return '<svg class="ch-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Histórico de precio: de ' + eur(first) + ' a ' + eur(last) + '">' +
      '<polyline points="' + line + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
  }

  function card(g) {
    var t = g.t, ai = t.ai && AI[t.ai.recomendacion];
    var tags = [];
    if (g.goal) tags.push('<span class="ch-tag ch-tag--goal">🎯 ¡Bajo tu objetivo!</span>');
    else if (t.target != null && g.price != null) tags.push('<span class="ch-tag">🎯 Objetivo ' + eur(t.target) + ' · faltan ' + eur(g.price - t.target) + '</span>');
    if (ai) tags.push('<span class="ch-tag ch-tag--' + ai.cls + '">' + ai.txt + '</span>');
    if (t.ai && typeof t.ai.score === 'number') tags.push('<span class="ch-tag" title="Deal Index de CholloGarde">📊 ' + t.ai.score + '/100</span>');
    var stores = g.stores.slice(0, 4).map(function (s, i) {
      var d = g.ref ? Math.round((1 - s.price / g.ref) * 100) : null;
      return '<a class="ch-store' + (i ? '' : ' ch-store--best') + '" href="' + esc(s.url || CG_URL) + '" target="_blank" rel="noopener" title="' + esc(s.match || s.name) + '">' +
        '<span class="ch-store__n">' + esc(s.name) + (s.type === 'official' ? '<small>oficial</small>' : s.type === 'key' ? '<small>key</small>' : '') + '</span>' +
        '<span class="ch-store__p">' + eur(s.price) + '</span>' +
        '<span class="ch-store__d' + (d > 0 ? ' ch-store__d--up' : '') + '">' + (d > 0 ? '−' + d + ' %' : s.type === 'official' ? 'ref.' : '') + '</span></a>';
    }).join('');
    var motivo = t.ai && t.ai.proxima_bajada ? '<p class="ch-ai"><b>IA:</b> ' + esc(t.ai.proxima_bajada) + '</p>' : '';
    return '<article class="ch-card' + (g.goal ? ' ch-card--goal' : '') + '">' +
      '<div class="ch-art"' + (g.img ? ' style="background-image:url(\'' + esc(g.img).replace(/'/g, '%27') + '\')"' : '') + '>' +
        (t.platform ? '<span class="ch-plat badge badge-plat ' + U().platformClass(t.platform) + '">' + esc(t.platform) + '</span>' : '') +
        (g.off > 0 ? '<span class="ch-off">−' + g.off + ' %</span>' : '<span class="ch-off ch-off--none">Sin rebaja</span>') +
        '<h3 class="ch-ttl">' + esc(t.title) + '</h3>' +
      '</div>' +
      '<div class="ch-body">' +
        '<div class="ch-price"><b>' + eur(g.price) + '</b>' + (g.ref && g.off > 0 ? '<s>' + eur(g.ref) + '</s>' : '') +
          (g.best ? '<span>en <em>' + esc(g.best.name) + '</em></span>' : '') + '</div>' +
        '<div class="ch-tags">' + tags.join('') + '</div>' +
        spark(t.history) +
        (stores ? '<div class="ch-stores">' + stores + '</div>' : '') +
        motivo +
        (g.best && g.best.url ? '<a class="ch-go" href="' + esc(g.best.url) + '" target="_blank" rel="noopener">🛒 Ir a ' + esc(g.best.name) + ' ↗</a>' : '') +
      '</div></article>';
  }

  function render(db, stale) {
    var games = (db.trackers || []).filter(function (t) { return t.cat === 'game'; }).map(game)
      .sort(function (a, b) { return (b.goal - a.goal) || (b.off - a.off) || ((a.price || 0) - (b.price || 0)); });
    if (!games.length) {
      $('chGrid').innerHTML = '<p class="ch-note">CholloGarde todavía no vigila ningún juego.</p>';
      $('chKpis').innerHTML = ''; $('chShops').innerHTML = '';
      return;
    }
    var top = games.slice().sort(function (a, b) { return b.off - a.off; })[0];
    var last = Math.max.apply(null, games.map(function (g) { return g.t.lastCheck || 0; }));
    var goals = games.filter(function (g) { return g.goal; }).length;
    var ahorro = games.reduce(function (s, g) { return s + (g.ref && g.price != null && g.price < g.ref ? g.ref - g.price : 0); }, 0);
    $('chKpis').innerHTML =
      '<div class="ch-kpi"><i>🎮</i><b>' + games.length + '</b><span>juegos vigilados</span></div>' +
      '<div class="ch-kpi ch-kpi--hot"><i>🔥</i><b>' + (top.off > 0 ? '−' + top.off + ' %' : '—') + '</b><span>' + (top.off > 0 ? 'mayor rebaja · ' + esc(top.t.title) : 'sin rebajas ahora mismo') + '</span></div>' +
      '<div class="ch-kpi"><i>🎯</i><b>' + goals + '</b><span>bajo vuestro objetivo</span></div>' +
      '<div class="ch-kpi"><i>💸</i><b>' + eur(ahorro) + '</b><span>de ahorro frente al precio oficial</span></div>';
    $('chUpdated').textContent = (stale ? '📴 Sin conexión · ' : '') + (last ? 'Revisado ' + ago(last) : '');
    $('chGrid').innerHTML = games.map(card).join('');

    // tiendas que más veces tienen el precio más bajo
    var shops = {};
    games.forEach(function (g) {
      if (!g.best) return;
      var s = shops[g.best.name] = shops[g.best.name] || { n: 0, titles: [] };
      s.n++; s.titles.push(g.t.title);
    });
    $('chShops').innerHTML = Object.keys(shops).sort(function (a, b) { return shops[b].n - shops[a].n; }).map(function (name, i) {
      var s = shops[name];
      return '<div class="ch-shop"><span class="ch-shop__r">' + (i + 1) + '</span><div><b>' + esc(name) + '</b>' +
        '<span>Más barato en ' + s.n + ' juego' + (s.n === 1 ? '' : 's') + ': ' + esc(s.titles.join(', ')) + '</span></div></div>';
    }).join('');
  }

  function load() {
    fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (db) {
        render(db, false);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), db: db })); } catch (e) { /* sin espacio: da igual */ }
      })
      .catch(function (err) {
        // sin conexión: la última copia guardada en este dispositivo
        var c = null;
        try { c = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) {}
        if (c && c.db) return render(c.db, true);
        console.warn('Chollos:', err);
        $('chGrid').innerHTML = '<p class="ch-note">No se han podido leer los chollos ahora mismo. <a href="' + CG_URL + '" target="_blank" rel="noopener" style="color:#22d3ee">Abrir CholloGarde ↗</a></p>';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    load();
    setInterval(function () { if (!document.hidden) load(); }, 10 * 60 * 1000); // CholloGarde revisa cada hora
  });
})();
