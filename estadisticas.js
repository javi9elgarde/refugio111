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
    Javi:  'rgba(34,197,94,0.85)',
    Mery:  'rgba(155,89,255,0.85)'
  };

  /* ── STAT CARDS ─────────────────────────────────────────── */
  function renderStatCards(year, player) {
    var stats    = Registro.getStats(year);
    var libCount = Biblioteca.getAll().length;

    if (player === 'All') {
      document.getElementById('sc-juegos').textContent = stats.totalJuegos;
      document.getElementById('sc-horas').textContent  = stats.totalHoras + 'h';
      document.getElementById('sc-nota').textContent   = stats.avgScore ? stats.avgScore.toFixed(2).replace('.', ',') : '—';
    } else {
      var ps = stats.porJugador[player] || { juegos: 0, horas: 0, avgScore: 0 };
      document.getElementById('sc-juegos').textContent = ps.juegos;
      document.getElementById('sc-horas').textContent  = ps.horas + 'h';
      document.getElementById('sc-nota').textContent   = ps.avgScore ? ps.avgScore.toFixed(2).replace('.', ',') : '—';
    }
    document.getElementById('sc-biblioteca').textContent = libCount;

    // Player comparison cards always show all 3 (year-filtered only)
    ['David', 'Javi', 'Mery'].forEach(function(p) {
      var key = p.toLowerCase();
      var ps  = stats.porJugador[p] || { juegos: 0, horas: 0, avgScore: 0 };
      document.getElementById(key + '-juegos').textContent = ps.juegos;
      document.getElementById(key + '-horas').textContent  = ps.horas + 'h';
      document.getElementById(key + '-nota').textContent   = ps.avgScore ? ps.avgScore.toFixed(2).replace('.', ',') : '—';
    });
  }

  /* ── GENRE CHART ─────────────────────────────────────────── */
  function renderGenreChart(year, player) {
    var data = Registro.getGenreStats(year, player).slice(0, 10);
    var ctx  = document.getElementById('chartGenres').getContext('2d');
    if (charts.genres) { charts.genres.destroy(); charts.genres = null; }
    if (!data.length) return;

    var COLORS = ['rgba(79,172,254,0.75)','rgba(155,89,255,0.75)','rgba(34,197,94,0.75)',
                  'rgba(236,72,153,0.75)','rgba(245,158,11,0.75)','rgba(6,182,212,0.75)',
                  'rgba(249,115,22,0.75)','rgba(132,204,22,0.75)','rgba(239,68,68,0.75)','rgba(168,85,247,0.75)'];

    charts.genres = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(function(d){ return d.genero; }),
        datasets: [{
          label: 'Partidas',
          data: data.map(function(d){ return d.count; }),
          backgroundColor: data.map(function(_, i){ return COLORS[i % COLORS.length]; }),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(c){ return ' ' + c.raw + ' partida' + (c.raw !== 1 ? 's' : ''); } } }
        },
        scales: {
          x: { ticks: { color: 'rgba(232,232,248,0.5)', font: CHART_FONT }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: 'rgba(232,232,248,0.8)', font: CHART_FONT }, grid: { display: false } }
        }
      }
    });
  }

  /* ── PLATFORM CHART ─────────────────────────────────────── */
  function renderPlatformChart(year, player) {
    var data = Registro.getPlatformStats(year, player).slice(0, 8);
    var ctx  = document.getElementById('chartPlatforms').getContext('2d');
    if (charts.platforms) { charts.platforms.destroy(); charts.platforms = null; }
    if (!data.length) return;

    var PLAT_COLORS = {
      'PC': '#2a7fff', 'PS5': '#003aba', 'PS4': '#0a52cc', 'PS3': '#1565c0',
      'Xbox Series X': '#107c10', 'Xbox One': '#1a9a1a', 'Xbox 360': '#2bb52b',
      'Nintendo Switch 2': '#e60012', 'Nintendo Switch': '#e83e3e'
    };

    charts.platforms = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(function(d){ return d.plataforma; }),
        datasets: [{
          data: data.map(function(d){ return d.count; }),
          backgroundColor: data.map(function(d){ return PLAT_COLORS[d.plataforma] || 'rgba(79,172,254,0.5)'; }),
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 'rgba(232,232,248,0.7)', font: CHART_FONT, padding: 12, boxWidth: 14 }
          },
          tooltip: {
            callbacks: {
              label: function(c){ return ' ' + c.label + ': ' + c.raw + ' partida' + (c.raw !== 1 ? 's' : ''); }
            }
          }
        }
      }
    });
  }

  /* ── HISTORY CHART (últimos 5 años) ─────────────────────── */
  function renderHistoryChart(player) {
    var ctx = document.getElementById('chartHistory').getContext('2d');
    if (charts.history) { charts.history.destroy(); charts.history = null; }

    var years = [];
    for (var y = currentYear - 4; y <= currentYear; y++) years.push(y);

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
        maintainAspectRatio: true,
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

  /* ── LOGROS ─────────────────────────────────────────────── */
  var LOGRO_GRADIENTS = [
    'linear-gradient(135deg,rgba(79,172,254,0.12),rgba(79,172,254,0.04))',
    'linear-gradient(135deg,rgba(155,89,255,0.12),rgba(155,89,255,0.04))',
    'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))',
    'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04))',
    'linear-gradient(135deg,rgba(236,72,153,0.12),rgba(236,72,153,0.04))',
    'linear-gradient(135deg,rgba(6,182,212,0.12),rgba(6,182,212,0.04))'
  ];

  function playerColor(p) {
    return p === 'David' ? 'var(--player-david)' : p === 'Javi' ? 'var(--player-javi)' : p === 'Mery' ? 'var(--player-mery)' : 'var(--txt1)';
  }

  function computeLogros(year, player) {
    var allReg  = Registro.getAll();
    var entries = allReg.slice();
    if (year) entries = entries.filter(function(r){ return r.año === year; });
    if (player && player !== 'All') entries = entries.filter(function(r){ return r.jugador === player; });

    var logros = [];
    var noDataHtml = '<span style="color:var(--txt3);font-size:0.8rem">Sin datos para este período</span>';

    /* 1 — Rey del Maratón: registro individual con más horas */
    var conHoras = entries.filter(function(r){ return parseFloat(r.horas) > 0; })
                          .sort(function(a,b){ return (parseFloat(b.horas)||0) - (parseFloat(a.horas)||0); });
    if (conHoras.length) {
      var top = conHoras[0];
      var game = Biblioteca.getById(top.juegoId);
      logros.push({
        icon: '🎮', title: 'Rey del Maratón', desc: 'Más horas invertidas en un solo juego',
        winner: top.jugador,
        detail: (game ? Utils.escapeHtml(game.titulo) : '—') + ' · ' + top.horas + 'h',
        value:  top.horas + 'h'
      });
    } else {
      logros.push({ icon:'🎮', title:'Rey del Maratón', desc:'Más horas en un solo juego', winner:null, detail:'', value:'' });
    }

    /* 2 — Maratonista: más horas totales en el período */
    var horasPJ = {};
    entries.forEach(function(r){
      horasPJ[r.jugador] = (horasPJ[r.jugador]||0) + (parseFloat(r.horas)||0);
    });
    var topH = Object.keys(horasPJ).sort(function(a,b){ return horasPJ[b]-horasPJ[a]; })[0];
    if (topH) {
      logros.push({
        icon:'⏱', title:'Maratonista', desc:'Más horas totales en el período',
        winner: topH,
        detail: Math.round(horasPJ[topH]) + ' horas jugadas',
        value:  Math.round(horasPJ[topH]) + 'h'
      });
    } else {
      logros.push({ icon:'⏱', title:'Maratonista', desc:'Más horas totales', winner:null, detail:'', value:'' });
    }

    /* 3 — Platinero: más platinos (siempre global, ignora filtros) */
    var platPJ = {};
    allReg.filter(function(r){ return r.estado === 'Platinado'; }).forEach(function(r){
      if (!platPJ[r.jugador]) platPJ[r.jugador] = new Set();
      platPJ[r.jugador].add(r.juegoId);
    });
    var topP = Object.keys(platPJ).sort(function(a,b){ return platPJ[b].size - platPJ[a].size; })[0];
    if (topP) {
      logros.push({
        icon:'🏆', title:'Platinero', desc:'Más trofeos platino conseguidos (global)',
        winner: topP,
        detail: platPJ[topP].size + ' platino' + (platPJ[topP].size !== 1 ? 's' : ''),
        value:  platPJ[topP].size + ' 🏆'
      });
    } else {
      logros.push({ icon:'🏆', title:'Platinero', desc:'Más platinos (global)', winner:null, detail:'Sin platinos registrados', value:'' });
    }

    /* 4 — Completista: más juegos terminados o platinados */
    var termPJ = {};
    entries.filter(function(r){ return r.estado === 'Terminado' || r.estado === 'Platinado'; }).forEach(function(r){
      if (!termPJ[r.jugador]) termPJ[r.jugador] = new Set();
      termPJ[r.jugador].add(r.juegoId);
    });
    var topC = Object.keys(termPJ).sort(function(a,b){ return termPJ[b].size - termPJ[a].size; })[0];
    if (topC) {
      logros.push({
        icon:'✅', title:'Completista', desc:'Más juegos completados o platinados',
        winner: topC,
        detail: termPJ[topC].size + ' juego' + (termPJ[topC].size !== 1 ? 's' : '') + ' completado' + (termPJ[topC].size !== 1 ? 's' : ''),
        value:  termPJ[topC].size
      });
    } else {
      logros.push({ icon:'✅', title:'Completista', desc:'Más juegos completados', winner:null, detail:'', value:'' });
    }

    /* 5 — El Exigente: nota media más baja */
    var notasPJ = {};
    entries.filter(function(r){ return r.nota !== null && r.nota !== '' && r.nota !== undefined; }).forEach(function(r){
      if (!notasPJ[r.jugador]) notasPJ[r.jugador] = [];
      notasPJ[r.jugador].push(parseFloat(r.nota));
    });
    var jugConNotas = Object.keys(notasPJ).filter(function(p){ return notasPJ[p].length >= 2; });
    if (jugConNotas.length) {
      var avgFn = function(arr){ return arr.reduce(function(s,x){return s+x;},0)/arr.length; };
      var topE = jugConNotas.sort(function(a,b){ return avgFn(notasPJ[a]) - avgFn(notasPJ[b]); })[0];
      var avgE = avgFn(notasPJ[topE]).toFixed(1).replace('.', ',');
      logros.push({
        icon:'⭐', title:'El Exigente', desc:'Nota media más baja — el más crítico',
        winner: topE,
        detail: 'Media de ' + avgE + ' puntos sobre 10',
        value:  avgE + ' ★'
      });
    } else {
      logros.push({ icon:'⭐', title:'El Exigente', desc:'Nota media más baja', winner:null, detail:'Necesita al menos 2 notas', value:'' });
    }

    /* 6 — Explorador: más géneros distintos jugados */
    var genPJ = {};
    entries.forEach(function(r){
      var g = Biblioteca.getById(r.juegoId);
      if (!g || !g.generos) return;
      if (!genPJ[r.jugador]) genPJ[r.jugador] = new Set();
      g.generos.forEach(function(gen){ genPJ[r.jugador].add(gen); });
    });
    var topG = Object.keys(genPJ).sort(function(a,b){ return genPJ[b].size - genPJ[a].size; })[0];
    if (topG) {
      logros.push({
        icon:'🌍', title:'Explorador', desc:'Más géneros distintos explorados',
        winner: topG,
        detail: genPJ[topG].size + ' género' + (genPJ[topG].size !== 1 ? 's' : '') + ' distintos',
        value:  genPJ[topG].size + ' géneros'
      });
    } else {
      logros.push({ icon:'🌍', title:'Explorador', desc:'Más géneros explorados', winner:null, detail:'', value:'' });
    }

    return logros;
  }

  function renderLogros(year, player) {
    var el     = document.getElementById('logrosGrid');
    var logros = computeLogros(year, player);

    el.innerHTML = logros.map(function(l, i) {
      var bg = LOGRO_GRADIENTS[i % LOGRO_GRADIENTS.length];
      var winnerHtml = l.winner
        ? '<div class="logro-winner" style="color:' + playerColor(l.winner) + '">' + Utils.escapeHtml(l.winner) + '</div>' +
          '<div class="logro-detail">' + l.detail + '</div>'
        : '<div class="logro-winner" style="color:var(--txt3);font-size:0.85rem">Sin datos</div>' +
          (l.detail ? '<div class="logro-detail">' + Utils.escapeHtml(l.detail) + '</div>' : '');
      return '<div class="logro-card" style="background:' + bg + '">' +
        '<div class="logro-icon">' + l.icon + '</div>' +
        '<div class="logro-body">' +
          '<div class="logro-title">' + Utils.escapeHtml(l.title) + '</div>' +
          '<div class="logro-desc">' + Utils.escapeHtml(l.desc) + '</div>' +
          winnerHtml +
        '</div>' +
        (l.winner ? '<div class="logro-value">' + Utils.escapeHtml(String(l.value)) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  /* ── RENDER ALL ─────────────────────────────────────────── */
  function renderAll(year, player) {
    renderStatCards(year, player);
    renderGenreChart(year, player);
    renderPlatformChart(year, player);
    renderHistoryChart(player);
    renderLogros(year, player);
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
    a.download = 'gametracker-backup-' + new Date().toISOString().slice(0, 10) + '.json';
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
    document.getElementById('navYear').textContent  = currentYear;
    document.getElementById('footerYear').textContent = currentYear;

    buildYearOptions();
    buildPlayerTabs();

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
