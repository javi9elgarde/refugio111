/* ============================================================
   REFUGIO 111 — Récords del Refugio (quién manda en cada categoría)
   GT.Records.render(el, año): año 0 = Global
   ============================================================ */
(function () {
  'use strict';

  var Utils      = window.GT.Utils;
  var Biblioteca = window.GT.Biblioteca;
  var Registro   = window.GT.Registro;

  /* ── LOGROS ─────────────────────────────────────────────── */
  function playerColor(p) {
    return p === 'David' ? 'var(--player-david)' : p === 'Javi' ? 'var(--player-javi)' : p === 'Mery' ? 'var(--player-mery)' : 'var(--txt1)';
  }

  function computeLogros(year, player) {
    var allReg  = Registro.getAll();
    var entries = allReg.slice();
    if (year) entries = entries.filter(function(r){ return r.año === year; });
    if (player && player !== 'All') entries = entries.filter(function(r){ return r.jugador === player; });

    var logros = [];

    /* 1 — Rey del Maratón: registro individual con más horas */
    var conHoras = entries.filter(function(r){ return parseFloat(r.horas) > 0; })
                          .sort(function(a,b){ return (parseFloat(b.horas)||0) - (parseFloat(a.horas)||0); });
    if (conHoras.length) {
      var top1 = conHoras[0];
      var game1 = Biblioteca.getById(top1.juegoId);
      logros.push({
        badge: '🎮 REY DEL MARATÓN', desc: 'Más horas en un único juego',
        visual: { type: 'cover', src: game1 && game1.portadaUrl ? game1.portadaUrl : '',
                  pos: game1 && game1.portadaPos ? game1.portadaPos : 'center top',
                  bg: 'linear-gradient(160deg,#050d1f,#0b1c38)' },
        gameId: top1.juegoId,
        winner: top1.jugador, valColor: '#4facfe',
        detail: game1 ? game1.titulo : '—',
        value:  top1.horas + 'h'
      });
    } else {
      logros.push({ badge:'🎮 REY DEL MARATÓN', desc:'Más horas en un único juego',
        visual:{ type:'icon', icon:'🎮', bg:'linear-gradient(160deg,#050d1f,#0b1c38)' },
        winner:null, detail:'Sin datos', value:'' });
    }

    /* 2 — Maratonista: más horas totales en el período */
    var horasPJ = {};
    entries.forEach(function(r){ horasPJ[r.jugador] = (horasPJ[r.jugador]||0) + (parseFloat(r.horas)||0); });
    var topH = Object.keys(horasPJ).sort(function(a,b){ return horasPJ[b]-horasPJ[a]; })[0];
    if (topH) {
      logros.push({
        badge: '⏱ MARATONISTA', desc: 'Más horas totales en el período',
        visual: { type: 'bigtext', text: Math.round(horasPJ[topH]) + 'h',
                  bg: 'linear-gradient(135deg,#0d0522,#1c0d40)' },
        winner: topH, valColor: '#c084fc',
        detail: Math.round(horasPJ[topH]) + ' horas jugadas',
        value:  Math.round(horasPJ[topH]) + 'h'
      });
    } else {
      logros.push({ badge:'⏱ MARATONISTA', desc:'Más horas totales',
        visual:{ type:'icon', icon:'⏱', bg:'linear-gradient(135deg,#0d0522,#1c0d40)' },
        winner:null, detail:'Sin datos', value:'' });
    }

    /* 3 — Platinero: más platinos (siempre global) */
    var platPJ = {};
    allReg.filter(function(r){ return r.estado === 'Platinado'; }).forEach(function(r){
      if (!platPJ[r.jugador]) platPJ[r.jugador] = new Set();
      platPJ[r.jugador].add(r.juegoId);
    });
    var topP = Object.keys(platPJ).sort(function(a,b){ return platPJ[b].size - platPJ[a].size; })[0];
    logros.push({
      badge: '🏆 PLATINERO', desc: 'Más trofeos platino — ranking global',
      visual: { type: 'trophy', src: 'platinum-trophy.png', bg: 'linear-gradient(135deg,#020818,#060e2e)' },
      winner: topP || null, valColor: '#93c5fd',
      detail: topP ? platPJ[topP].size + ' platino' + (platPJ[topP].size !== 1 ? 's' : '') : 'Sin platinos aún',
      value:  topP ? platPJ[topP].size : ''
    });

    /* 4 — Completista: más juegos terminados o platinados */
    var termPJ = {};
    entries.filter(function(r){ return r.estado === 'Terminado' || r.estado === 'Platinado'; }).forEach(function(r){
      if (!termPJ[r.jugador]) termPJ[r.jugador] = new Set();
      termPJ[r.jugador].add(r.juegoId);
    });
    var topC = Object.keys(termPJ).sort(function(a,b){ return termPJ[b].size - termPJ[a].size; })[0];
    if (topC) {
      logros.push({
        badge: '✅ COMPLETISTA', desc: 'Más juegos completados o platinados',
        visual: { type: 'bigtext', text: termPJ[topC].size + '',
                  sub: termPJ[topC].size !== 1 ? 'juegos' : 'juego',
                  bg: 'linear-gradient(135deg,#041a0c,#082e14)' },
        winner: topC, valColor: '#4ade80',
        detail: termPJ[topC].size + ' juego' + (termPJ[topC].size !== 1 ? 's' : '') + ' completado' + (termPJ[topC].size !== 1 ? 's' : ''),
        value:  termPJ[topC].size
      });
    } else {
      logros.push({ badge:'✅ COMPLETISTA', desc:'Más juegos completados',
        visual:{ type:'icon', icon:'✅', bg:'linear-gradient(135deg,#041a0c,#082e14)' },
        winner:null, detail:'Sin datos', value:'' });
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
        badge: '⭐ EL EXIGENTE', desc: 'Nota media más baja — el más crítico',
        visual: { type: 'bigtext', text: avgE, sub: '/ 10', bg: 'linear-gradient(135deg,#1a0505,#2e0808)' },
        winner: topE, valColor: '#f87171',
        detail: 'Media de ' + avgE + ' puntos sobre 10',
        value:  avgE + ' ★'
      });
    } else {
      logros.push({ badge:'⭐ EL EXIGENTE', desc:'Nota media más baja',
        visual:{ type:'icon', icon:'⭐', bg:'linear-gradient(135deg,#1a0505,#2e0808)' },
        winner:null, detail:'Necesita al menos 2 notas', value:'' });
    }

    /* 6 — El Optimista: nota media más alta */
    var playersWithNotas = Object.keys(notasPJ).filter(function(p){ return notasPJ[p].length >= 2; });
    if (playersWithNotas.length) {
      var avgFnO = function(arr){ return arr.reduce(function(s,x){return s+x;},0)/arr.length; };
      var topO = playersWithNotas.slice().sort(function(a,b){ return avgFnO(notasPJ[b]) - avgFnO(notasPJ[a]); })[0];
      var avgO = avgFnO(notasPJ[topO]).toFixed(1).replace('.', ',');
      logros.push({
        badge: '🌟 EL OPTIMISTA', desc: 'Nota media más alta — el más generoso',
        visual: { type: 'bigtext', text: avgO, sub: '/ 10', bg: 'linear-gradient(135deg,#1a1400,#2e2500)' },
        winner: topO, valColor: '#fbbf24',
        detail: 'Media de ' + avgO + ' puntos sobre 10',
        value:  avgO + ' ★'
      });
    } else {
      logros.push({ badge:'🌟 EL OPTIMISTA', desc:'Nota media más alta',
        visual:{ type:'icon', icon:'🌟', bg:'linear-gradient(135deg,#1a1400,#2e2500)' },
        winner:null, detail:'Necesita al menos 2 notas', value:'' });
    }

    /* 7 — Rejugador: más juegos con estado Rejugado */
    var rejPJ = {};
    entries.filter(function(r){ return r.estado === 'Rejugado'; }).forEach(function(r){
      if (!rejPJ[r.jugador]) rejPJ[r.jugador] = new Set();
      rejPJ[r.jugador].add(r.juegoId);
    });
    var topRej = Object.keys(rejPJ).sort(function(a,b){ return rejPJ[b].size - rejPJ[a].size; })[0];
    if (topRej) {
      logros.push({
        badge: '🔥 REJUGADOR', desc: 'Más juegos completados más de una vez',
        visual: { type: 'bigtext', text: rejPJ[topRej].size + '',
                  sub: rejPJ[topRej].size !== 1 ? 'juegos' : 'juego',
                  bg: 'linear-gradient(135deg,#1a0505,#2e0808)' },
        winner: topRej, valColor: '#fb923c',
        detail: rejPJ[topRej].size + ' juego' + (rejPJ[topRej].size !== 1 ? 's' : '') + ' rejugado' + (rejPJ[topRej].size !== 1 ? 's' : ''),
        value:  rejPJ[topRej].size
      });
    } else {
      logros.push({ badge:'🔥 REJUGADOR', desc:'Más juegos completados más de una vez',
        visual:{ type:'icon', icon:'🔥', bg:'linear-gradient(135deg,#1a0505,#2e0808)' },
        winner:null, detail:'Nadie ha rejugado aún', value:'' });
    }

    /* 9 — La nota más baja: registro individual con la puntuación más baja */
    var conNotaMin = entries.filter(function(r){ return r.nota !== null && r.nota !== '' && r.nota !== undefined; })
                            .sort(function(a,b){ return parseFloat(a.nota) - parseFloat(b.nota); });
    if (conNotaMin.length) {
      var minEntry = conNotaMin[0];
      var minGame  = Biblioteca.getById(minEntry.juegoId);
      var minNota  = parseFloat(minEntry.nota).toFixed(1).replace('.', ',');
      logros.push({
        badge: '💀 LA NOTA MÁS BAJA', desc: 'La puntuación individual más baja puesta',
        visual: minGame && minGame.portadaUrl
          ? { type: 'cover', src: minGame.portadaUrl, pos: minGame.portadaPos || 'center top', bg: 'linear-gradient(160deg,#1a0505,#2e0808)' }
          : { type: 'bigtext', text: minNota, sub: '/ 10', bg: 'linear-gradient(160deg,#1a0505,#2e0808)' },
        gameId: minGame ? minEntry.juegoId : null,
        winner: minEntry.jugador, valColor: '#f87171',
        detail: (minGame ? minGame.titulo : '—') + ' — ' + minNota + ' / 10',
        value:  minNota + ' / 10'
      });
    } else {
      logros.push({ badge:'💀 LA NOTA MÁS BAJA', desc:'La puntuación individual más baja puesta',
        visual:{ type:'icon', icon:'💀', bg:'linear-gradient(160deg,#1a0505,#2e0808)' },
        winner:null, detail:'Sin notas registradas', value:'' });
    }

    /* 10 — El Retro: jugador cuyo juego más antiguo tiene el año de lanzamiento más bajo */
    var retroPJ = {}; /* jugador → { año, titulo } */
    entries.forEach(function(r) {
      var g = Biblioteca.getById(r.juegoId);
      if (!g || !g.fechaLanzamiento) return;
      var yr = parseInt((g.fechaLanzamiento + '').substring(0, 4));
      if (!yr || isNaN(yr)) return;
      if (!retroPJ[r.jugador] || yr < retroPJ[r.jugador].año) {
        retroPJ[r.jugador] = { año: yr, titulo: g.titulo, portadaUrl: g.portadaUrl || '', portadaPos: g.portadaPos || 'center top', juegoId: r.juegoId };
      }
    });
    var retroPlayers = Object.keys(retroPJ);
    if (retroPlayers.length) {
      var topRetro = retroPlayers.sort(function(a,b){ return retroPJ[a].año - retroPJ[b].año; })[0];
      var retroGame = retroPJ[topRetro];
      logros.push({
        badge: '🕹️ EL RETRO', desc: 'Juego más antiguo jugado — viaje al pasado',
        visual: retroGame.portadaUrl
          ? { type: 'cover', src: retroGame.portadaUrl, pos: retroGame.portadaPos, bg: 'linear-gradient(160deg,#12080a,#251018)' }
          : { type: 'bigtext', text: retroGame.año + '', sub: 'año', bg: 'linear-gradient(160deg,#12080a,#251018)' },
        gameId: retroGame.juegoId || null,
        winner: topRetro, valColor: '#f59e0b',
        detail: retroGame.titulo + ' (' + retroGame.año + ')',
        value:  retroGame.año + ''
      });
    } else {
      logros.push({ badge:'🕹️ EL RETRO', desc:'Juego más antiguo jugado',
        visual:{ type:'icon', icon:'🕹️', bg:'linear-gradient(160deg,#12080a,#251018)' },
        winner:null, detail:'Sin datos de lanzamiento', value:'' });
    }

    /* 9 — Explorador: más géneros distintos jugados */
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
        badge: '🌍 EXPLORADOR', desc: 'Más géneros distintos explorados',
        visual: { type: 'bigtext', text: genPJ[topG].size + '',
                  sub: genPJ[topG].size !== 1 ? 'géneros' : 'género',
                  bg: 'linear-gradient(135deg,#031420,#04203a)' },
        winner: topG, valColor: '#22d3ee',
        detail: genPJ[topG].size + ' géneros distintos',
        value:  genPJ[topG].size + ' géneros'
      });
    } else {
      logros.push({ badge:'🌍 EXPLORADOR', desc:'Más géneros explorados',
        visual:{ type:'icon', icon:'🌍', bg:'linear-gradient(135deg,#031420,#04203a)' },
        winner:null, detail:'Sin datos', value:'' });
    }

    return logros;
  }

  // los récords con un año (El Retro) no llevan punto de miles
  function noYear(v) { return /^\d{4}$/.test(String(v)) ? String(v) : Utils.miles(v); }
  function renderLogros(el, year, player) {
    var logros = computeLogros(year, player);

    el.innerHTML = logros.map(function(l) {
      var v = l.visual;

      /* Banner visual content */
      var bannerInner = '';
      if (v.type === 'cover' && v.src) {
        bannerInner = '<img class="logro-banner__cover" src="' + Utils.escapeHtml(v.src) +
          '" style="object-position:' + Utils.escapeHtml(v.pos || 'center top') +
          '" onerror="this.style.display=\'none\'">';
      } else if (v.type === 'trophy') {
        bannerInner = '<img class="logro-banner__trophy" src="' + Utils.escapeHtml(v.src) + '" alt="Platino" onerror="this.style.display=\'none\'">';
      } else if (v.type === 'bigtext') {
        bannerInner = '<div class="logro-banner__bignum">' + Utils.escapeHtml(noYear(v.text)) +
          (v.sub ? '<span class="logro-banner__bignumsub">' + Utils.escapeHtml(v.sub) + '</span>' : '') +
          '</div>';
      } else {
        bannerInner = '<div class="logro-banner__icon">' + (v.icon || '') + '</div>';
      }

      /* Footer */
      var footerHtml;
      if (l.winner) {
        footerHtml =
          '<div class="logro-footer__info">' +
            '<div class="logro-winner-name" style="color:' + playerColor(l.winner) + '">' + Utils.escapeHtml(l.winner) + '</div>' +
            '<div class="logro-winner-detail">' + Utils.escapeHtml(l.detail) + '</div>' +
          '</div>' +
          '<div class="logro-footer__val" style="color:' + (l.valColor || 'var(--txt2)') + '">' + Utils.escapeHtml(noYear(l.value)) + '</div>';
      } else {
        footerHtml =
          '<div class="logro-footer__info">' +
            '<div class="logro-winner-name" style="color:var(--txt3);font-size:0.85rem">Sin datos</div>' +
            '<div class="logro-winner-detail">' + Utils.escapeHtml(l.detail || '') + '</div>' +
          '</div>';
      }

      var cardClick = l.gameId
        ? ' onclick="window.GT.GameDetailModal.open(\'' + l.gameId.replace(/'/g, "\\'") + '\')" style="cursor:pointer" title="Ver ficha del juego"'
        : '';
      return '<div class="logro-card"' + cardClick + '>' +
        '<div class="logro-banner" style="background:' + v.bg + '">' +
          bannerInner +
          '<div class="logro-banner__overlay">' +
            '<span class="logro-badge">' + Utils.escapeHtml(l.badge) + '</span>' +
            '<span class="logro-desc-badge">' + Utils.escapeHtml(l.desc) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="logro-footer">' + footerHtml + '</div>' +
      '</div>';
    }).join('');
  }

  window.GT.Records = { render: function (el, year) { renderLogros(el, year || null, 'All'); } };
})();
