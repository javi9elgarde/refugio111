/* ============================================================
   REFUGIO 111 — Jugadores (perfil + estadísticas en una página)
   Aquí vive el selector de jugador y la ventana de detalle; el perfil lo
   pinta pendientes.js y las gráficas estadisticas.js, y los dos escuchan
   el evento «gt:jugador».
   ============================================================ */
(function () {
  'use strict';

  var COLORS = { David: '#3b82f6', Javi: '#dc2626', Mery: '#a855f7' };
  var ap = window.GT.getActivePlayer && window.GT.getActivePlayer();
  var JG = window.GT_JG = { player: COLORS[ap] ? ap : 'David', colors: COLORS };

  function esc(s) { return window.GT.Utils.escapeHtml(s == null ? '' : String(s)); }

  JG.setPlayer = function (key) {
    if (!COLORS[key]) return;
    JG.player = key;
    document.querySelectorAll('#jgSwitch [data-player]').forEach(function (b) {
      var on = b.dataset.player === key;
      b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('.jg-cmp [data-col]').forEach(function (c) { c.classList.toggle('is-on', c.dataset.col === key); });
    document.querySelector('.jg').style.setProperty('--pc', COLORS[key]);
    document.dispatchEvent(new CustomEvent('gt:jugador', { detail: key }));
  };

  /* ── VENTANA DE DETALLE ─────────────────────────────────── */
  function modal(title, html, wide) {
    document.querySelector('.jg-modal').classList.toggle('jg-modal--wide', wide === 'wide');
    document.getElementById('jgModalTitle').textContent = title;
    document.getElementById('jgModalBody').innerHTML = html;
    document.getElementById('jgModal').classList.add('open');
  }
  JG.modal = modal;
  function closeModal() { document.getElementById('jgModal').classList.remove('open'); }

  // logro sin juego asociado: tarjeta grande con su valor
  JG.showLogro = function (l) {
    modal(l.shortName || l.badge, '<div class="jg-lg" style="background:' + l.bg + '">' +
      '<div class="jg-lg__ico">' + (l.visual && l.visual.type === 'trophy' ? '<img src="platinum-trophy.png" alt="">' : esc(l.emoji || '🏅')) + '</div>' +
      '<b>' + esc(l.badge) + '</b><p>' + esc(l.desc) + '</p>' +
      '<div class="jg-lg__val">' + esc(String(l.value)) + '</div><small>' + esc(l.detail || '') + '</small></div>');
  };

  // partidas detrás de un trozo de gráfica (un género, una plataforma, un año)
  JG.showGames = function (title, entries) {
    var seen = {}, B = window.GT.Biblioteca, U = window.GT.Utils;
    var list = entries.filter(function (r) { if (seen[r.juegoId]) return false; return (seen[r.juegoId] = true); });
    modal(title + ' · ' + list.length + ' juego' + (list.length !== 1 ? 's' : ''), list.length ? '<div class="jg-gl">' + list.map(function (r) {
      var g = B.getById(r.juegoId);
      return '<button type="button" class="jg-gl__i" data-game="' + esc(r.juegoId) + '">' +
        (g && g.portadaUrl ? '<img src="' + esc(U.thumb(g.portadaUrl, 420)) + '" alt="" loading="lazy">' : '<span></span>') +
        '<b>' + esc(g ? g.titulo : '(Juego eliminado)') + '</b>' +
        '<small>' + esc(r.estado) + (r.nota != null && r.nota !== '' ? ' · ' + U.formatScore(r.nota) : '') + (r.horas ? ' · ' + r.horas + 'h' : '') + '</small></button>';
    }).join('') + '</div>' : '<p style="color:var(--txt3)">Sin juegos</p>');
  };

  /* ── INCLINACIÓN 3D DE LAS PORTADAS ─────────────────────── */
  function tilt(e) {
    var c = e.target.closest('.jp-fav--filled');
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * 14 + 'deg');
    c.style.setProperty('--rx', (0.5 - (e.clientY - r.top) / r.height) * 14 + 'deg');
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('jgSwitch').addEventListener('click', function (e) {
      var b = e.target.closest('[data-player]'); if (b) JG.setPlayer(b.dataset.player);
    });
    document.getElementById('jgModalClose').addEventListener('click', closeModal);
    document.getElementById('jgModal').addEventListener('click', function (e) {
      if (e.target === this) return closeModal();
      var g = e.target.closest('[data-game]');
      if (g) { closeModal(); window.GT.GameDetailModal.open(g.dataset.game); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var box = document.getElementById('playerProfiles');
      box.addEventListener('pointermove', tilt);
      box.addEventListener('pointerout', function (e) { var c = e.target.closest('.jp-fav--filled'); if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } });
    }
    window.GT.onDataReady(function () { JG.setPlayer(JG.player); });
  });
})();
