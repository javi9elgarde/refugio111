/* ============================================================
   GAMETRACKER — Jugadores / Perfiles Page
   Version: 20260518d
   ============================================================ */
(function () {
  'use strict';

  var Utils      = window.GT.Utils;
  var Biblioteca = window.GT.Biblioteca;
  var Registro   = window.GT.Registro;
  var Toast      = window.GT.Toast;

  var PLAYERS = [
    { key: 'David', name: 'David Garde',   initial: 'D', color: 'var(--player-david)' },
    { key: 'Javi',  name: 'Javier Garde',  initial: 'J', color: 'var(--player-javi)'  },
    { key: 'Mery',  name: 'Mariam Moreno', initial: 'M', color: 'var(--player-mery)'  }
  ];

  // Modal state
  var _modal = { gameId: null, playerKey: null };

  function safe(fn, name) {
    try { fn(); } catch(e) { console.warn('pendientes.js ' + name + ':', e); }
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER PLAYER PROFILE
  ══════════════════════════════════════════════════════════════ */
  function renderPlayer(player) {
    var key   = player.key;
    var color = player.color;

    /* --- Pending games ---------------------------------------- */
    var pendingGames = Biblioteca.getAll().filter(function(g) {
      return (g.pendientePor || []).includes(key);
    }).sort(function(a, b) { return a.titulo.localeCompare(b.titulo, 'es'); });

    /* --- Registro data ---------------------------------------- */
    var entries    = Registro.filter({ jugador: key });
    var totalJuegos = new Set(entries.map(function(r) { return r.juegoId; })).size;
    var totalHoras  = Math.round(entries.reduce(function(acc, r) { return acc + (parseFloat(r.horas) || 0); }, 0));
    var scored      = entries.filter(function(r) { return r.nota !== null && r.nota !== undefined && r.nota !== ''; });
    var avgScore    = scored.length
      ? Math.round((scored.reduce(function(a, r) { return a + parseFloat(r.nota); }, 0) / scored.length) * 100) / 100
      : null;

    /* --- Top rated -------------------------------------------- */
    var gameScores = {};
    scored.forEach(function(r) {
      if (!gameScores[r.juegoId]) gameScores[r.juegoId] = [];
      gameScores[r.juegoId].push(parseFloat(r.nota));
    });
    var topRated = Object.keys(gameScores).map(function(id) {
      var notas = gameScores[id];
      var avg   = Math.round((notas.reduce(function(a, b) { return a + b; }, 0) / notas.length) * 100) / 100;
      return { game: Biblioteca.getById(id), avg: avg };
    }).filter(function(x) { return x.game; })
      .sort(function(a, b) { return b.avg - a.avg; })
      .slice(0, 6);

    /* --- Completados (Terminado / Rejugado, deduplicated) ------- */
    var completadosSeen = {};
    var completados = [];
    entries.filter(function(r) { return r.estado === 'Terminado' || r.estado === 'Rejugado'; })
      .forEach(function(r) {
        if (!completadosSeen[r.juegoId]) {
          completadosSeen[r.juegoId] = true;
          var g = Biblioteca.getById(r.juegoId);
          if (g) completados.push({ game: g, entry: r });
        }
      });

    /* ── Build HTML ──────────────────────────────────────────── */

    var statsStr = totalJuegos + ' jugados · ' + totalHoras + 'h' +
      (avgScore ? ' · ★ ' + avgScore.toFixed(2).replace('.', ',') : '');

    var headerHtml =
      '<div class="pp-header">' +
        '<div class="pp-avatar" style="background:' + color + '">' + player.initial + '</div>' +
        '<div style="flex:1">' +
          '<div class="pp-name">' + Utils.escapeHtml(player.name) + '</div>' +
          '<div class="pp-stats">' + pendingGames.length + ' pendientes · ' + statsStr + '</div>' +
        '</div>' +
        '<a href="registro.html" class="btn btn-ghost btn-sm" style="font-size:0.75rem">📋 Registro</a>' +
      '</div>';

    /* ── Pending games list (portada + título + duración + botón done) */
    var pendListHtml;
    if (pendingGames.length) {
      pendListHtml = pendingGames.map(function(game, idx) {
        var hidden = idx >= 8 ? ' pp-pend-item--more hidden' : '';
        var dur    = game.duracion ? '⏱ ' + game.duracion + 'h' : '';
        var safeId = game.id.replace(/'/g, "\\'");
        var safeKey = key.replace(/'/g, "\\'");

        var coverHtml =
          '<div class="pp-pend-cover">' +
            (game.portadaUrl
              ? '<img src="' + Utils.escapeHtml(game.portadaUrl) + '" alt="" ' +
                'style="object-position:' + Utils.escapeHtml(game.portadaPos || 'center top') + '" ' +
                'onerror="this.style.display=\'none\'">'
              : '') +
            '<span class="pp-pend-cover__ph">' + Utils.escapeHtml(game.titulo.charAt(0)) + '</span>' +
          '</div>';

        return '<div class="pp-pend-item' + hidden + '">' +
          coverHtml +
          '<div style="flex:1;min-width:0">' +
            '<div class="pp-pend-title">' + Utils.escapeHtml(game.titulo) + '</div>' +
            (dur ? '<div class="pp-pend-dur">' + dur + '</div>' : '') +
          '</div>' +
          '<button class="pp-done-btn" title="Marcar como jugado" ' +
            'onclick="window.GT_Pend.openDoneModal(\'' + safeId + '\',\'' + safeKey + '\')">' +
            '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><polyline points="4,10 8,14 16,6"/></svg>' +
          '</button>' +
        '</div>';
      }).join('');

      if (pendingGames.length > 8) {
        pendListHtml += '<button class="btn btn-ghost btn-sm pp-show-more" ' +
          'onclick="window.GT_Pend.toggleMore(this)">+ Ver ' + (pendingGames.length - 8) + ' más</button>';
      }
    } else {
      pendListHtml = '<p style="font-size:0.8rem;color:var(--txt3);font-style:italic;padding:0.5rem 0">Sin juegos pendientes asignados.<br>' +
        '<a href="biblioteca.html" style="color:' + color + '">Márcarlos en la Biblioteca →</a></p>';
    }

    /* ── Top rated --------------------------------------------- */
    var topHtml = topRated.length
      ? '<div class="pp-top-grid">' + topRated.map(function(item) {
          var sc = Utils.scoreColor(item.avg);
          var objPos = Utils.escapeHtml(item.game.portadaPos || 'center top');
          return '<div class="pp-top-item" onclick="window.GT.GameDetailModal.open(\'' + item.game.id + '\')" title="' + Utils.escapeHtml(item.game.titulo) + '">' +
            '<div class="pp-top-cover">' +
              (item.game.portadaUrl
                ? '<img src="' + Utils.escapeHtml(item.game.portadaUrl) + '" alt="" style="object-position:' + objPos + '">'
                : '<div class="pp-top-ph">' + Utils.escapeHtml(item.game.titulo.charAt(0)) + '</div>') +
            '</div>' +
            '<div style="font-size:0.67rem;font-weight:600;text-align:center;margin-top:0.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--txt2)">' + Utils.escapeHtml(item.game.titulo) + '</div>' +
            '<div style="text-align:center;font-family:Orbitron,sans-serif;font-size:0.72rem;font-weight:700;color:' + sc + '">' + Utils.formatScore(item.avg) + '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<p style="font-size:0.8rem;color:var(--txt3);font-style:italic;padding:0.5rem 0">Sin notas registradas aún</p>';

    /* ── Completados -------------------------------------------- */
    var compHtml = completados.length
      ? completados.slice(0, 12).map(function(item) {
          var sc = Utils.scoreColor(item.entry.nota);
          return '<div class="pp-comp-item" onclick="window.GT.GameDetailModal.open(\'' + item.game.id + '\')">' +
            '<div class="mini-cover" style="width:30px;height:30px;flex-shrink:0">' +
              (item.game.portadaUrl ? '<img src="' + Utils.escapeHtml(item.game.portadaUrl) + '" alt="" onerror="this.style.display=\'none\'">' : '') +
              '<span class="mini-cover__letter" style="font-size:0.6rem">' + Utils.escapeHtml(item.game.titulo.charAt(0)) + '</span>' +
            '</div>' +
            '<span style="flex:1;min-width:0;font-size:0.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + Utils.escapeHtml(item.game.titulo) + '</span>' +
            (item.entry.nota !== null && item.entry.nota !== undefined && item.entry.nota !== ''
              ? '<span style="font-family:Orbitron,sans-serif;font-size:0.72rem;font-weight:700;color:' + sc + ';flex-shrink:0">' + Utils.formatScore(item.entry.nota) + '</span>'
              : '') +
            '<span class="badge badge-terminado" style="font-size:0.62rem;flex-shrink:0">' + Utils.escapeHtml(item.entry.estado) + '</span>' +
          '</div>';
        }).join('')
      : '<p style="font-size:0.8rem;color:var(--txt3);font-style:italic;padding:0.5rem 0">Sin juegos completados aún</p>';

    /* ── Compose section ---------------------------------------- */
    return '<div class="player-profile" style="--pp-color:' + color + '">' +
      headerHtml +
      '<div class="pp-body">' +
        '<div class="pp-sub">' +
          '<div class="pp-sub-title">⏳ Pendientes (' + pendingGames.length + ')</div>' +
          '<div class="pp-pend-list">' + pendListHtml + '</div>' +
        '</div>' +
        '<div class="pp-sub">' +
          '<div class="pp-sub-title">⭐ Mejores valorados</div>' +
          topHtml +
        '</div>' +
        '<div class="pp-sub">' +
          '<div class="pp-sub-title">🏆 Completados (' + completados.length + ')</div>' +
          '<div class="pp-comp-list">' + compHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── RENDER ALL ─────────────────────────────────────────────── */
  function render() {
    var container = document.getElementById('playerProfiles');
    if (!container) return;
    container.innerHTML = PLAYERS.map(function(p) { return renderPlayer(p); }).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     DONE MODAL
  ══════════════════════════════════════════════════════════════ */
  function injectDoneModal() {
    if (document.getElementById('pendDoneOverlay')) return;
    var el = document.createElement('div');
    el.id = 'pendDoneOverlay';
    el.innerHTML =
      '<div class="pend-done-box" id="pendDoneBox">' +
        '<div class="pend-done-icon">🎮</div>' +
        '<div class="pend-done-game-title" id="pendDoneGameTitle">—</div>' +
        '<p class="pend-done-question">¿Qué quieres hacer con este juego?</p>' +
        '<button class="pend-done-finish" id="pendDoneFinish">' +
          '<span class="pend-done-finish__icon">🏆</span>' +
          '<span>¡¡JUEGO FINALIZADO!!</span>' +
        '</button>' +
        '<button class="pend-done-discard" id="pendDoneDiscard">🗑 Descartar pendiente</button>' +
        '<button class="pend-done-cancel" id="pendDoneCancel">✕ Cancelar</button>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener('click', function(e) { if (e.target === el) closeDoneModal(); });
    document.getElementById('pendDoneCancel').addEventListener('click', closeDoneModal);
    document.getElementById('pendDoneFinish').addEventListener('click', function() {
      var gameId = _modal.gameId;
      var playerKey = _modal.playerKey;
      closeDoneModal();
      markFinished(gameId, playerKey);
    });
    document.getElementById('pendDoneDiscard').addEventListener('click', function() {
      var gameId = _modal.gameId;
      var playerKey = _modal.playerKey;
      closeDoneModal();
      markDiscarded(gameId, playerKey);
    });
  }

  function openDoneModal(gameId, playerKey) {
    var game = Biblioteca.getById(gameId);
    if (!game) return;
    _modal.gameId    = gameId;
    _modal.playerKey = playerKey;
    document.getElementById('pendDoneGameTitle').textContent = game.titulo;
    var overlay = document.getElementById('pendDoneOverlay');
    overlay.classList.add('open');
    requestAnimationFrame(function() {
      document.getElementById('pendDoneBox').style.transform = 'scale(1)';
    });
  }

  function closeDoneModal() {
    var overlay = document.getElementById('pendDoneOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  /* ══════════════════════════════════════════════════════════════
     ACTIONS
  ══════════════════════════════════════════════════════════════ */

  /* Remove player from pendientePor without ceremony */
  function markDiscarded(gameId, playerKey) {
    var game = Biblioteca.getById(gameId);
    if (!game) return;
    var por = (game.pendientePor || []).filter(function(p) { return p !== playerKey; });
    Biblioteca.update(gameId, { pendientePor: por, pendiente: por.length > 0 });
    Toast.show('"' + game.titulo + '" eliminado de pendientes');
    render();
  }

  /* Remove from pending + full celebration */
  function markFinished(gameId, playerKey) {
    var game = Biblioteca.getById(gameId);
    if (!game) return;
    var por = (game.pendientePor || []).filter(function(p) { return p !== playerKey; });
    Biblioteca.update(gameId, { pendientePor: por, pendiente: por.length > 0 });
    showCelebration(game.titulo, playerKey);
    render();
  }

  function toggleMore(btn) {
    var list  = btn.closest('.pp-pend-list');
    var items = list.querySelectorAll('.pp-pend-item--more');
    var anyHidden = Array.prototype.some.call(items, function(el) { return el.classList.contains('hidden'); });
    if (anyHidden) {
      items.forEach(function(el) { el.classList.remove('hidden'); });
      btn.textContent = '▲ Ver menos';
    } else {
      items.forEach(function(el) { el.classList.add('hidden'); });
      btn.textContent = '+ Ver ' + items.length + ' más';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     CELEBRATION — fireworks + sound + text
  ══════════════════════════════════════════════════════════════ */

  function showCelebration(gameTitle, playerKey) {
    /* 1. Play victory sound */
    safe(playVictorySound, 'sound');

    /* 2. Build overlay */
    var overlay = document.createElement('div');
    overlay.id = 'celebrationOverlay';

    var playerColor = playerKey === 'David' ? '#3b82f6' :
                      playerKey === 'Javi'  ? '#9b1742' : '#9b59ff';

    overlay.innerHTML =
      '<canvas id="celebFireworks"></canvas>' +
      '<div class="celeb-text">' +
        '<div class="celeb-trophy">🏆</div>' +
        '<div class="celeb-badge">¡¡JUEGO FINALIZADO!!</div>' +
        '<div class="celeb-game">' + Utils.escapeHtml(gameTitle) + '</div>' +
        '<div class="celeb-player" style="color:' + playerColor + '">— ' + Utils.escapeHtml(playerKey) + ' —</div>' +
        '<div class="celeb-hint">Toca en cualquier lugar para cerrar</div>' +
      '</div>';

    document.body.appendChild(overlay);

    /* 3. Fade in */
    requestAnimationFrame(function() {
      overlay.classList.add('show');
    });

    /* 4. Launch fireworks */
    var stopFW = launchFireworks(document.getElementById('celebFireworks'));

    /* 5. Close on click or after 6s */
    function closeIt() {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      if (stopFW) stopFW();
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 520);
    }

    overlay.addEventListener('click', closeIt);
    setTimeout(closeIt, 6000);
  }

  /* ── VICTORY SOUND (Web Audio API — no external files) ──────── */
  function playVictorySound() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx = new AudioCtx();

    /* Ascending arpeggio: C5 E5 G5 + final chord C5+E5+G5 */
    var melody = [
      { freq: 523.25, t: 0,    dur: 0.18 },   /* C5 */
      { freq: 659.25, t: 0.16, dur: 0.18 },   /* E5 */
      { freq: 783.99, t: 0.32, dur: 0.18 },   /* G5 */
      { freq: 1046.5, t: 0.50, dur: 0.55 }    /* C6 — sustained */
    ];

    /* Chord under the final note */
    var chord = [
      { freq: 523.25, t: 0.50, dur: 0.55 },
      { freq: 659.25, t: 0.50, dur: 0.55 }
    ];

    function playNote(freq, startT, dur, vol, type) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, startT);
      gain.gain.setValueAtTime(0, startT);
      gain.gain.linearRampToValueAtTime(vol, startT + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);
      osc.start(startT);
      osc.stop(startT + dur + 0.05);
    }

    var now = ctx.currentTime;
    melody.forEach(function(n) { playNote(n.freq, now + n.t, n.dur, 0.35, 'sine'); });
    chord.forEach(function(n)  { playNote(n.freq, now + n.t, n.dur, 0.18, 'sine'); });

    /* Percussion hit at the start */
    (function() {
      var buf  = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      var src  = ctx.createBufferSource();
      var gain = ctx.createGain();
      src.buffer = buf;
      src.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      src.start(now);
      src.stop(now + 0.12);
    })();
  }

  /* ── FIREWORKS CANVAS ───────────────────────────────────────── */
  function launchFireworks(canvas) {
    var W = canvas.width  = window.innerWidth;
    var H = canvas.height = window.innerHeight;
    var ctx   = canvas.getContext('2d');
    var parts = [];
    var rafId = null;
    var stopped = false;

    var COLORS = [
      '#ff6b6b','#ffd700','#4facfe','#00f2fe',
      '#f093fb','#43e97b','#fa709a','#fff4b2','#a8edea'
    ];

    function burst(x, y) {
      var color = COLORS[Math.floor(Math.random() * COLORS.length)];
      var count = 70 + Math.floor(Math.random() * 40);
      for (var i = 0; i < count; i++) {
        var angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.3;
        var speed = 2.5 + Math.random() * 5.5;
        parts.push({
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          life: 1,
          decay: 0.012 + Math.random() * 0.012,
          size:  2.5 + Math.random() * 2.5,
          color: color,
          trail: Math.random() > 0.5
        });
      }
    }

    /* Schedule bursts */
    var burstCount = 0;
    var maxBursts  = 14;
    function scheduleBurst() {
      if (stopped || burstCount >= maxBursts) return;
      burstCount++;
      var x = W * 0.15 + Math.random() * W * 0.7;
      var y = H * 0.08 + Math.random() * H * 0.55;
      burst(x, y);
      if (burstCount < maxBursts) {
        setTimeout(scheduleBurst, 250 + Math.random() * 350);
      }
    }
    scheduleBurst();
    setTimeout(scheduleBurst, 100);
    setTimeout(scheduleBurst, 220);

    /* Render loop */
    function tick() {
      ctx.fillStyle = 'rgba(7,7,15,0.18)';
      ctx.fillRect(0, 0, W, H);

      parts = parts.filter(function(p) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.09;   /* gravity */
        p.vx *= 0.985;
        p.life -= p.decay;
        if (p.life <= 0) return false;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle   = p.color;
        if (p.trail) {
          ctx.fillRect(p.x, p.y, p.size * p.life, p.size * p.life * 0.4);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });

      if (!stopped && (parts.length > 0 || burstCount < maxBursts)) {
        rafId = requestAnimationFrame(tick);
      }
    }
    tick();

    return function stop() {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */
  function init() {
    document.getElementById('navYear').textContent    = new Date().getFullYear();
    document.getElementById('footerYear').textContent = new Date().getFullYear();
    injectDoneModal();
    render();
  }

  window.GT_Pend = { openDoneModal: openDoneModal, toggleMore: toggleMore };

  document.addEventListener('DOMContentLoaded', function () {
    window.GT.onDataReady(function () {
      safe(init, 'init');
      window.GT.onDataChange(function () { safe(render, 'render'); });
    });
  });
})();
