/* ============================================================
   GAMETRACKER — Pendientes Page
   ============================================================ */
(function () {
  'use strict';

  var Utils      = window.GT.Utils;
  var Biblioteca = window.GT.Biblioteca;
  var Registro   = window.GT.Registro;
  var Toast      = window.GT.Toast;

  var state = { tab: 'marcados', search: '', plataforma: '' };

  function safe(fn, name) {
    try { fn(); } catch(e) { console.warn('pendientes.js ' + name + ':', e); }
  }

  /* ── TAB SWITCHING ──────────────────────────────────────── */
  function setTab(tab) {
    state.tab = tab;
    var btnM = document.getElementById('tabMarcados');
    var btnR = document.getElementById('tabRetomar');
    var gM   = document.getElementById('gridMarcados');
    var gR   = document.getElementById('gridRetomar');

    if (tab === 'marcados') {
      btnM.className = 'btn btn-primary btn-sm';
      btnR.className = 'btn btn-secondary btn-sm';
      gM.style.display = '';
      gR.style.display = 'none';
      renderMarcados();
    } else {
      btnM.className = 'btn btn-secondary btn-sm';
      btnR.className = 'btn btn-primary btn-sm';
      gM.style.display = 'none';
      gR.style.display = '';
      renderRetomar();
    }
  }

  /* ── PLATFORM FILTER CHIPS ──────────────────────────────── */
  function renderPlatChips() {
    var plats = Biblioteca.getAllPlatforms();
    var pc = document.getElementById('pendPlatChips');
    pc.innerHTML = plats.map(function(p) {
      return '<span class="badge badge-genre' + (state.plataforma === p ? ' active' : '') + '" data-plat="' + Utils.escapeHtml(p) + '">' + Utils.escapeHtml(p) + '</span>';
    }).join('');
    pc.querySelectorAll('[data-plat]').forEach(function(el) {
      el.addEventListener('click', function() {
        state.plataforma = state.plataforma === this.dataset.plat ? '' : this.dataset.plat;
        renderPlatChips();
        render();
      });
    });
  }

  /* ── RENDER MARCADOS ────────────────────────────────────── */
  function renderMarcados() {
    var games = Biblioteca.search(state.search, {
      pendiente: true,
      plataforma: state.plataforma || undefined
    });

    var grid  = document.getElementById('gridMarcados');
    var empty = document.getElementById('pendEmpty');
    var count = document.getElementById('pendCount');

    count.textContent = games.length + ' juego' + (games.length !== 1 ? 's' : '') + ' pendientes';

    if (!games.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    grid.innerHTML = games.map(function(game) {
      var coverContent = game.portadaUrl
        ? '<img src="' + Utils.escapeHtml(game.portadaUrl) + '" alt="' + Utils.escapeHtml(game.titulo) + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
          '<div class="game-card__ph" style="display:none"><span class="game-card__ph-letter">' + Utils.escapeHtml(game.titulo.charAt(0)) + '</span></div>'
        : '<div class="game-card__ph"><span class="game-card__ph-letter">' + Utils.escapeHtml(game.titulo.charAt(0)) + '</span><span class="game-card__ph-name">' + Utils.escapeHtml(game.titulo) + '</span></div>';

      return '<div class="game-card card card--glow">' +
        '<div class="game-card__cover">' + coverContent +
          '<div class="game-card__overlay">' +
            '<button class="btn btn-secondary btn-sm" onclick="window.GT_Pend.markPlayed(\'' + game.id + '\')">✓ Jugado</button>' +
            '<a href="biblioteca.html" class="btn btn-secondary btn-sm">✏️</a>' +
          '</div>' +
        '</div>' +
        '<div class="game-card__body">' +
          '<div class="game-card__title">' + Utils.escapeHtml(game.titulo) + '</div>' +
          (game.desarrollador ? '<div class="game-card__dev">' + Utils.escapeHtml(game.desarrollador) + '</div>' : '') +
          '<div class="game-card__platforms">' + Utils.platformBadgesHtml(game.plataformas) + '</div>' +
          '<div class="game-card__genres">' + Utils.genreBadgesHtml(game.generos) + '</div>' +
          (game.fechaLanzamiento ? '<div style="font-size:0.72rem;color:var(--txt3);margin-top:0.25rem">📅 ' + Utils.escapeHtml(game.fechaLanzamiento) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ── RENDER RETOMAR ─────────────────────────────────────── */
  function renderRetomar() {
    var entries = Registro.filter({ estado: 'Retomar' });
    var query   = state.search.toLowerCase();

    if (query) {
      entries = entries.filter(function(r) {
        var game = Biblioteca.getById(r.juegoId);
        return game && game.titulo.toLowerCase().includes(query);
      });
    }

    var body  = document.getElementById('retomarBody');
    var empty = document.getElementById('pendEmpty');
    var count = document.getElementById('pendCount');

    count.textContent = entries.length + ' entrada' + (entries.length !== 1 ? 's' : '') + ' en Retomar';

    if (!entries.length) {
      body.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    body.innerHTML = entries.map(function(r) {
      var game = Biblioteca.getById(r.juegoId);
      var titulo = game ? game.titulo : '(Juego eliminado)';

      return '<tr>' +
        '<td><div class="game-cell">' +
          '<div class="mini-cover">' +
            (game && game.portadaUrl ? '<img src="' + Utils.escapeHtml(game.portadaUrl) + '" alt="" onerror="this.style.display=\'none\'">' : '') +
            '<span class="mini-cover__letter">' + Utils.escapeHtml(titulo.charAt(0)) + '</span>' +
          '</div>' +
          '<span style="font-weight:600">' + Utils.escapeHtml(titulo) + '</span>' +
        '</div></td>' +
        '<td><span class="badge ' + Utils.playerBadge(r.jugador) + '">' + Utils.escapeHtml(r.jugador) + '</span></td>' +
        '<td><span style="font-size:0.8rem;color:var(--txt2)">' + Utils.monthName(r.mes) + ' ' + r.año + '</span></td>' +
        '<td><span style="font-size:0.85rem;color:var(--txt2)">' + (r.horas ? r.horas + 'h' : '—') + '</span></td>' +
        '<td>' + (r.plataformaJugada ? '<span class="badge badge-plat ' + Utils.platformClass(r.plataformaJugada) + '">' + Utils.escapeHtml(r.plataformaJugada) + '</span>' : '—') + '</td>' +
        '<td><a href="registro.html" class="btn btn-ghost btn-sm">Ver registro</a></td>' +
      '</tr>';
    }).join('');
  }

  /* ── MARK AS PLAYED ─────────────────────────────────────── */
  function markPlayed(gameId) {
    Biblioteca.update(gameId, { pendiente: false });
    Toast.show('Juego movido a la biblioteca ✓');
    render();
    renderPlatChips();
  }

  /* ── UNIFIED RENDER ─────────────────────────────────────── */
  function render() {
    if (state.tab === 'marcados') renderMarcados();
    else renderRetomar();
  }

  /* ── INIT ───────────────────────────────────────────────── */
  function init() {
    document.getElementById('navYear').textContent = new Date().getFullYear();
    document.getElementById('footerYear').textContent = new Date().getFullYear();

    document.getElementById('pendSearch').addEventListener('input', function() {
      state.search = this.value;
      render();
    });

    renderPlatChips();
    setTab('marcados');
  }

  window.GT_Pend = { setTab: setTab, markPlayed: markPlayed };
  document.addEventListener('DOMContentLoaded', function () {
    window.GT.onDataReady(function () {
      safe(init, 'init');
      window.GT.onDataChange(function () { safe(render, 'render'); });
    });
  });
})();
