/* ============================================================
   GAMETRACKER — Estadísticas Page
   ============================================================ */
(function () {
  'use strict';

  var Utils      = window.GT.Utils;
  var Biblioteca = window.GT.Biblioteca;
  var Registro   = window.GT.Registro;
  var Toast      = window.GT.Toast;

  var charts = { genres: null, platforms: null, history: null };
  var currentYear = new Date().getFullYear();
  var state = { year: currentYear, player: 'All' };

  function safe(fn, name) {
    try { fn(); } catch(e) { console.warn('estadisticas.js ' + name + ':', e); }
  }

  var CHART_FONT = { family: "'Inter', sans-serif" };
  var PLAYER_COLORS = {
    David: 'rgba(79,172,254,0.85)',
    Javi:  'rgba(220,38,38,0.85)',
    Mery:  'rgba(155,89,255,0.85)'
  };

  /* ── DATOS DE UN JUGADOR EN UN AÑO ──────────────────────── */
  var DONE = { Terminado: 1, Platinado: 1, Rejugado: 1, Jugado: 1 };
  function uniq(list, f) { var s = {}; list.forEach(function (r) { if (!f || f(r)) s[r.juegoId] = 1; }); return Object.keys(s).length; }
  function statsOf(player, year) {
    var e = Registro.filter({ jugador: player, año: year || null });
    var notas = e.filter(function (r) { return r.nota !== null && r.nota !== undefined && r.nota !== ''; });
    return {
      juegos: uniq(e),
      horas: Math.round(e.reduce(function (a, r) { return a + (parseFloat(r.horas) || 0); }, 0)),
      nota: notas.length ? notas.reduce(function (a, r) { return a + parseFloat(r.nota); }, 0) / notas.length : null,
      completados: uniq(e, function (r) { return DONE[r.estado]; }),
      platinos: uniq(e, function (r) { return r.estado === 'Platinado'; })
    };
  }
  var esc = function (s) { return Utils.escapeHtml(s == null ? '' : String(s)); };
  var nota = function (n) { return n === null ? '—' : n.toFixed(2).replace('.', ','); };
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // los números suben desde 0 hasta su valor
  function countUp(root) {
    root.querySelectorAll('[data-to]').forEach(function (el) {
      var to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec || '0', 10), suf = el.dataset.suf || '';
      var fmt = function (v) { return (dec ? v.toFixed(dec).replace('.', ',') : Utils.miles(Math.round(v))) + suf; };
      if (REDUCED) { el.textContent = fmt(to); return; }
      var t0 = performance.now();
      (function step(t) {
        var k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(to * e);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  }
  // las barras crecen desde 0 hasta --w / --h
  function grow(root) { requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('is-in'); }); }); }

  /* ── ESTE AÑO CONTRA EL ANTERIOR ─────────────────────────── */
  function renderVs(player, year) {
    var y = year || currentYear, a = statsOf(player, y), b = statsOf(player, y - 1);
    var card = function (lbl, ico, va, vb, opt) {
      var d;
      if (opt.dec) d = (va === null || vb === null) ? null : { txt: (va - vb >= 0 ? '+' : '') + (va - vb).toFixed(2).replace('.', ','), up: va >= vb };
      else d = vb ? { txt: (va >= vb ? '+' : '') + Math.round((va - vb) / vb * 100) + '%', up: va >= vb } : (va ? { txt: 'nuevo', up: true } : null);
      return '<div class="st-vs__c">' +
        '<span class="st-vs__i">' + ico + '</span><small>' + lbl + '</small>' +
        '<b' + (va === null ? '>—' : ' data-to="' + va + '" data-dec="' + (opt.dec || 0) + '" data-suf="' + (opt.suf || '') + '">0') + '</b>' +
        (d ? '<span class="st-vs__d st-vs__d--' + (d.up ? 'up' : 'down') + '">' + (d.up ? '▲ ' : '▼ ') + d.txt + '</span>' : '<span class="st-vs__d">—</span>') +
        '<em>' + (y - 1) + ': ' + (vb === null ? '—' : opt.dec ? nota(vb) : Utils.miles(vb) + (opt.suf || '')) + '</em></div>';
    };
    var el = document.getElementById('stVs');
    el.innerHTML = '<div class="st-vs__h">' + y + ' <span>vs</span> ' + (y - 1) + '</div>' +
      card('Juegos', '🎮', a.juegos, b.juegos, {}) + card('Horas', '⏱', a.horas, b.horas, { suf: 'h' }) +
      card('Completados', '✅', a.completados, b.completados, {}) + card('Nota media', '⭐', a.nota, b.nota, { dec: 2 });
    countUp(el);
  }

  /* ── DONDE MÁS HORAS: los 5 juegos con más horas ──────────── */
  function renderTop(player, year) {
    var el = document.getElementById('stTop'), h = {};
    Registro.filter({ jugador: player, año: year || null }).forEach(function (r) { h[r.juegoId] = (h[r.juegoId] || 0) + (parseFloat(r.horas) || 0); });
    var top = Object.keys(h).filter(function (id) { return h[id] > 0; }).sort(function (x, y) { return h[y] - h[x]; }).slice(0, 5);
    if (!top.length) { el.innerHTML = '<p class="st-none">Sin horas registradas</p>'; return; }
    el.innerHTML = top.map(function (id, i) {
      var g = Biblioteca.getById(id);
      return '<button type="button" class="st-top__g" data-game="' + esc(id) + '" style="--w:' + (h[id] / h[top[0]] * 100) + '%;--d:' + (i * 80) + 'ms">' +
        '<span class="st-top__c">' + (g && g.portadaUrl ? '<img src="' + esc(Utils.thumb(g.portadaUrl, 420)) + '" alt="" loading="lazy">' : '') + '<i>' + (i + 1) + '</i></span>' +
        '<span class="st-top__t"><b>' + esc(g ? g.titulo : '—') + '</b><span class="st-top__bar"><i></i></span></span>' +
        '<strong>' + Utils.miles(Math.round(h[id])) + 'h</strong></button>';
    }).join('');
    grow(el);
  }

  /* ── GÉNEROS: barras con icono ───────────────────────────── */
  var GENRE_ICO = { 'Acción': '💥', 'Acción Aventura': '🗡️', 'Aventura': '🧭', 'Aventura Gráfica': '🖼️', 'Carreras': '🏎️', 'Deportes': '⚽', 'Estrategia': '♟️',
    'Lucha': '🥊', 'Plataformas': '🍄', 'Puzzle': '🧩', 'RPG': '🐉', 'Shooter': '🔫', 'Simulación': '🚜', 'Terror': '👻', 'Sigilo': '🥷', 'Survival': '🔥',
    'Roguelike': '🎲', 'Roguelike/Roguelite': '🎲', 'Metroidvania': '🦇', 'Souls-like': '⚔️', 'Soulslike': '⚔️', 'Mundo abierto': '🗺️', 'Sandbox': '🧱', 'Musical': '🎵', 'Party': '🎉', 'MMO': '🌐' };
  function renderGenres(player, year) {
    var el = document.getElementById('stGenres');
    var data = Registro.getGenreStats(year, player).slice(0, 8), total = data.reduce(function (s, d) { return s + d.count; }, 0);
    if (!data.length) { el.innerHTML = '<p class="st-none">Sin datos</p>'; return; }
    el.innerHTML = data.map(function (d, i) {
      return '<button type="button" class="st-gb" data-genero="' + esc(d.genero) + '" style="--w:' + (d.count / data[0].count * 100) + '%;--d:' + (i * 60) + 'ms">' +
        '<span class="st-gb__i">' + (GENRE_ICO[d.genero] || '🎮') + '</span><span class="st-gb__t">' + esc(d.genero) + '</span>' +
        '<span class="st-gb__bar"><i></i></span><span class="st-gb__n">' + d.count + ' <small>' + Math.round(d.count / total * 100) + '%</small></span></button>';
    }).join('');
    grow(el);
  }

  /* ── PLATAFORMAS: por marca, con su logo ─────────────────── */
  var LOGO = 'https://cdn.jsdelivr.net/npm/simple-icons@9.0.0/icons/';
  var FAMS = [
    { k: 'PlayStation', re: /^PS/, ico: 'playstation', c: '#0070d1' },
    { k: 'Xbox', re: /^Xbox/, ico: 'xbox', c: '#107c10' },
    { k: 'Nintendo', re: /^Nintendo/, ico: 'nintendoswitch', c: '#e60012' },
    { k: 'PC', re: /./, ico: 'steam', c: '#66c0f4' }
  ];
  function famOf(p) { return FAMS.filter(function (f) { return f.re.test(p || 'PC'); })[0]; }
  function renderPlats(player, year) {
    var el = document.getElementById('stPlats');
    var data = Registro.getPlatformStats(year, player), total = data.reduce(function (s, d) { return s + d.count; }, 0);
    if (!total) { el.innerHTML = '<p class="st-none">Sin datos</p>'; return; }
    el.innerHTML = FAMS.map(function (f) {
      var mine = data.filter(function (d) { return famOf(d.plataforma) === f; }), n = mine.reduce(function (s, d) { return s + d.count; }, 0);
      if (!n) return '';
      return '<button type="button" class="st-pf" data-fam="' + f.k + '" style="--c:' + f.c + ';--w:' + (n / total * 100) + '%">' +
        '<img src="' + LOGO + f.ico + '.svg" alt="" loading="lazy"><span class="st-pf__t"><b>' + f.k + '</b><small>' + mine.map(function (d) { return esc(d.plataforma) + ' ' + d.count; }).join(' · ') + '</small></span>' +
        '<span class="st-pf__p">' + Math.round(n / total * 100) + '%</span><span class="st-pf__bar"><i></i></span></button>';
    }).join('');
    grow(el);
  }

  /* ── DUELO: reparto entre los tres ───────────────────────── */
  var PCOL = { David: '#3b82f6', Javi: '#dc2626', Mery: '#a855f7' };
  function renderDuel(year) {
    var el = document.getElementById('stDuel'), ps = ['David', 'Javi', 'Mery'];
    var st = {}; ps.forEach(function (p) { st[p] = statsOf(p, year); });
    var row = function (lbl, k, dec) {
      var vals = ps.map(function (p) { return st[p][k] || 0; }), sum = vals.reduce(function (a, v) { return a + v; }, 0) || 1;
      var best = Math.max.apply(null, vals);
      return '<div class="st-du"><div class="st-du__h"><b>' + lbl + '</b></div><div class="st-du__bar">' + ps.map(function (p, i) {
        return '<i style="--c:' + PCOL[p] + ';--w:' + (vals[i] / sum * 100) + '%" title="' + p + '"></i>';
      }).join('') + '</div><div class="st-du__v">' + ps.map(function (p, i) {
        return '<span style="color:' + PCOL[p] + '">' + (vals[i] === best && best ? '👑 ' : '') + (dec ? nota(st[p][k]) : Utils.miles(vals[i])) + '</span>';
      }).join('') + '</div></div>';
    };
    el.innerHTML = '<div class="st-du__who">' + ps.map(function (p) { return '<span style="--c:' + PCOL[p] + '"><img src="cara_' + p.toLowerCase() + '.png" alt="">' + p + '</span>'; }).join('') + '</div>' +
      row('Juegos', 'juegos') + row('Horas', 'horas') + row('Completados', 'completados') + row('Platinos', 'platinos') + row('Nota media', 'nota', true);
    grow(el);
  }

  // pulsar cualquier barra abre la lista de juegos que hay detrás
  function initClicks() {
    document.getElementById('stats').addEventListener('click', function (e) {
      var y = state.year || null, p = state.player, b;
      if ((b = e.target.closest('[data-genero]'))) return pick('genero', b.dataset.genero, y, p);
      if ((b = e.target.closest('[data-fam]'))) {
        var f = FAMS.filter(function (x) { return x.k === b.dataset.fam; })[0];
        return window.GT_JG.showGames(p + ' · ' + f.k + (y ? ' · ' + y : ''), Registro.filter({ jugador: p, año: y }).filter(function (r) { return famOf(r.plataformaJugada) === f; }));
      }
      if ((b = e.target.closest('.st-top [data-game]'))) window.GT.GameDetailModal.open(b.dataset.game);
    });
  }

  /* ── HISTORY CHART (últimos 10 años) ────────────────────── */
  function renderHistoryChart(player) {
    var ctx = document.getElementById('chartHistory').getContext('2d');
    if (charts.history) { charts.history.destroy(); charts.history = null; }

    var years = [];
    for (var y = currentYear - 9; y <= currentYear; y++) years.push(y);

    var datasets;
    if (player === 'All') {
      datasets = ['David', 'Javi', 'Mery'].map(function(p) {
        return {
          label: p,
          data: years.map(function(yr) {
            var e = Registro.filter({ jugador: p, año: yr });
            return new Set(e.map(function(r){ return r.juegoId; })).size;
          }),
          backgroundColor: PLAYER_COLORS[p],
          borderColor: PLAYER_COLORS[p],
          borderRadius: 5,
          borderSkipped: false
        };
      });
    } else {
      var playerColor = PLAYER_COLORS[player] || 'rgba(79,172,254,0.8)';
      datasets = [{
        label: player,
        data: years.map(function(yr) {
          var e = Registro.filter({ jugador: player, año: yr });
          return new Set(e.map(function(r){ return r.juegoId; })).size;
        }),
        backgroundColor: playerColor,
        borderColor: playerColor,
        borderRadius: 5,
        borderSkipped: false
      }];
    }

    var hasData = datasets.some(function(ds){ return ds.data.some(function(v){ return v > 0; }); });
    if (!hasData) return;

    charts.history = new Chart(ctx, {
      type: 'bar',
      data: { labels: years, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function (e, els) { if (els.length) pick('año', years[els[0].index], null, player === 'All' ? datasets[els[0].datasetIndex].label : player); },
        plugins: {
          legend: {
            display: player === 'All',
            labels: { color: 'rgba(232,232,248,0.7)', font: CHART_FONT, padding: 14, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: function(c){ return ' ' + c.dataset.label + ': ' + c.raw + ' juego' + (c.raw !== 1 ? 's' : ''); }
            }
          }
        },
        scales: {
          x: {
            stacked: player === 'All',
            ticks: { color: 'rgba(232,232,248,0.6)', font: Object.assign({}, CHART_FONT, { weight: '700' }) },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            stacked: player === 'All',
            beginAtZero: true,
            ticks: { color: 'rgba(232,232,248,0.5)', font: CHART_FONT, stepSize: 1 },
            grid: { color: 'rgba(255,255,255,0.06)' }
          }
        }
      }
    });
  }

  function pick(kind, val, year, player) {
    if (!window.GT_JG) return;
    var list = Registro.filter({ jugador: player, año: kind === 'año' ? val : year });
    if (kind === 'genero') list = list.filter(function (r) { var g = Biblioteca.getById(r.juegoId); return g && (g.generos || []).indexOf(val) !== -1; });
    if (kind === 'plat') list = list.filter(function (r) { return (r.plataformaJugada || 'PC') === val; });
    window.GT_JG.showGames((player !== 'All' ? player + ' · ' : '') + val + (kind !== 'año' && year ? ' · ' + year : ''), list);
  }

  /* ── RENDER ALL ─────────────────────────────────────────── */
  function renderAll(year, player) {
    renderVs(player, year);
    renderTop(player, year);
    renderGenres(player, year);
    renderPlats(player, year);
    renderDuel(year);
    renderHistoryChart(player);
  }

  /* ── EXPORT / IMPORT ────────────────────────────────────── */
  function exportData() {
    var data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      biblioteca: Biblioteca.getAll(),
      registro: Registro.getAll()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = 'refugio111-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('Datos exportados ✓');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data.biblioteca || !data.registro) throw new Error('Formato inválido');
        var totalB = data.biblioteca.length, totalR = data.registro.length;
        if (!confirm('¿Importar ' + totalB + ' juegos y ' + totalR + ' entradas?\nEsto sobrescribirá los datos actuales en Firestore.')) return;

        Toast.show('Borrando datos actuales...');
        var db = window.GT.db;

        function deleteDocs(docs) {
          if (!docs.length) return Promise.resolve();
          var chunks = [];
          for (var i = 0; i < docs.length; i += 400) chunks.push(docs.slice(i, i + 400));
          return chunks.reduce(function(p, ch) {
            return p.then(function() {
              var b = db.batch(); ch.forEach(function(d){ b.delete(d.ref); }); return b.commit();
            });
          }, Promise.resolve());
        }

        function writeDocs(col, items) {
          var now = new Date().toISOString();
          var chunks = [];
          for (var i = 0; i < items.length; i += 400) chunks.push(items.slice(i, i + 400));
          return chunks.reduce(function(p, ch) {
            return p.then(function() {
              var b = db.batch();
              ch.forEach(function(item){ b.set(db.collection(col).doc(item.id), Object.assign({}, item, { importadoEn: now })); });
              return b.commit();
            });
          }, Promise.resolve());
        }

        Promise.all([db.collection('biblioteca').get(), db.collection('registro').get()])
          .then(function(res){ return deleteDocs(res[0].docs.concat(res[1].docs)); })
          .then(function(){ Toast.show('Importando ' + totalB + ' juegos... ☕'); return writeDocs('biblioteca', data.biblioteca); })
          .then(function(){ Toast.show('Importando ' + totalR + ' entradas...'); return writeDocs('registro', data.registro); })
          .then(function(){
            Toast.show('¡' + totalB + ' juegos y ' + totalR + ' entradas importadas! ✓ Recargando...');
            setTimeout(function(){ location.reload(); }, 2000);
          })
          .catch(function(err){ Toast.show('Error Firestore: ' + err.message, 'error'); });
      } catch(err) {
        Toast.show('Error al leer fichero: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ── YEAR OPTIONS ───────────────────────────────────────── */
  function buildYearOptions() {
    var sel = document.getElementById('statsYear');
    var years = [];
    for (var y = currentYear; y >= 2020; y--) years.push(y);
    sel.innerHTML = '<option value="0">🌐 Global</option>' +
      years.map(function(y){
        return '<option value="' + y + '"' + (y === currentYear ? ' selected' : '') + '>' + y + '</option>';
      }).join('');
    sel.value = String(currentYear);
    sel.addEventListener('change', function(){
      state.year = parseInt(this.value) || 0;
      renderAll(state.year || null, state.player);
    });
  }

  /* ── PLAYER TABS ────────────────────────────────────────── */
  function buildPlayerTabs() {
    if (window.GT_JG) {
      state.player = window.GT_JG.player;
      document.addEventListener('gt:jugador', function (e) { state.player = e.detail; renderAll(state.year || null, state.player); });
      return;
    }
    document.getElementById('statsPlayerTabs').querySelectorAll('.player-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.player = this.dataset.player;
        document.querySelectorAll('#statsPlayerTabs .player-tab').forEach(function(b){ b.className = 'player-tab'; });
        var cls = state.player === 'All' ? 'active-all' :
                  'active-' + state.player.toLowerCase();
        this.className = 'player-tab ' + cls;
        renderAll(state.year || null, state.player);
      });
    });
  }

  /* ── INIT ───────────────────────────────────────────────── */
  function init() {
    var _ny = document.getElementById('navYear'); if (_ny) _ny.textContent = currentYear;
    var _fy = document.getElementById('footerYear'); if (_fy) _fy.textContent = currentYear;

    buildYearOptions();
    buildPlayerTabs();
    initClicks();

    /* Pre-select active player from localStorage */
    var ap = window.GT.getActivePlayer ? window.GT.getActivePlayer() : null;
    if (ap && ap !== 'All' && !window.GT_JG) {
      state.player = ap;
      document.querySelectorAll('#statsPlayerTabs .player-tab').forEach(function(b){ b.className = 'player-tab'; });
      var activeTab = document.querySelector('#statsPlayerTabs [data-player="' + ap + '"]');
      if (activeTab) activeTab.className = 'player-tab active-' + ap.toLowerCase();
    }

    document.getElementById('btnExport').addEventListener('click', exportData);
    document.getElementById('btnImport').addEventListener('click', function(){ document.getElementById('importFile').click(); });
    document.getElementById('importFile').addEventListener('change', function(){ if (this.files[0]) importData(this.files[0]); this.value = ''; });
    document.getElementById('btnReset').addEventListener('click', function(){
      if (!confirm('¿Restaurar los datos de demostración? Perderás los cambios actuales.')) return;
      window.GT.SampleData.reset();
      Toast.show('Datos de demo restaurados. Recargando...');
      setTimeout(function(){ location.reload(); }, 1000);
    });

    renderAll(state.year, state.player);
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.GT.onDataReady(function () {
      safe(init, 'init');
      window.GT.onDataChange(function () {
        safe(function(){ renderAll(state.year || null, state.player); }, 'renderAll');
      });
    });
  });
})();
