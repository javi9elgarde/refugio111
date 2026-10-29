/* ============================================================
   GAMETRACKER — Registro Page
   Version: 20260521b
   ============================================================ */
(function () {
  'use strict';

  var Utils      = window.GT.Utils;
  var Biblioteca = window.GT.Biblioteca;
  var Registro   = window.GT.Registro;
  var Toast      = window.GT.Toast;

  var state      = { player: 'All', year: 0, month: '', tab: '', plat: '', editId: null, sortAsc: false };
  var _quickModal = { entryId: null };

  function safe(fn, name) {
    try { fn(); } catch(e) { console.warn('registro.js ' + name + ':', e); }
  }

  /* ── QUICK COMPLETE MODAL ───────────────────────────────────── */
  function injectQuickModal() {
    if (document.getElementById('regQuickOverlay')) return;
    var el = document.createElement('div');
    el.id = 'regQuickOverlay';
    el.className = 'reg-quick-overlay';
    el.innerHTML =
      '<div class="reg-quick-box">' +
        '<div class="reg-quick-icon">🎮</div>' +
        '<div class="reg-quick-title" id="regQuickTitle">—</div>' +
        '<div class="reg-quick-fields">' +
          '<div class="reg-quick-field">' +
            '<label class="reg-quick-label">Estado</label>' +
            '<select class="form-select" id="regQuickEstado">' +
              '<option value="Terminado">Terminado</option>' +
              '<option value="Platinado">Platinado</option>' +
              '<option value="Rejugado">Rejugado</option>' +
              '<option value="Jugando">Jugando</option>' +
              '<option value="Retomar">Retomar</option>' +
              '<option value="Abandonado">Abandonado</option>' +
              '<option value="Jugado">Jugado</option>' +
            '</select>' +
          '</div>' +
          '<div class="reg-quick-field">' +
            '<label class="reg-quick-label">Nota (0–10)</label>' +
            '<input type="number" class="form-input" id="regQuickNota" min="0" max="10" step="0.5" placeholder="Ej: 8.5">' +
          '</div>' +
          '<div class="reg-quick-field">' +
            '<label class="reg-quick-label">Horas jugadas</label>' +
            '<input type="number" class="form-input" id="regQuickHoras" min="0" step="0.5" placeholder="Ej: 25">' +
          '</div>' +
        '</div>' +
        '<div class="reg-quick-footer">' +
          '<button class="pend-done-cancel" id="regQuickCancel">✕ Cancelar</button>' +
          '<button class="reg-quick-save" id="regQuickSave">✓ Guardar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function(e) { if (e.target === el) closeQuickModal(); });
    document.getElementById('regQuickCancel').addEventListener('click', closeQuickModal);
    document.getElementById('regQuickSave').addEventListener('click', saveQuickEntry);
  }

  function openQuickModal(entryId) {
    var r = Registro.getById(entryId);
    if (!r) return;
    var game = Biblioteca.getById(r.juegoId);
    _quickModal.entryId = entryId;
    document.getElementById('regQuickTitle').textContent = game ? game.titulo : 'Sin título';
    document.getElementById('regQuickEstado').value = r.estado || 'Terminado';
    document.getElementById('regQuickNota').value   = (r.nota !== null && r.nota !== undefined && r.nota !== '') ? r.nota : '';
    document.getElementById('regQuickHoras').value  = r.horas || '';
    document.getElementById('regQuickOverlay').classList.add('open');
  }

  function closeQuickModal() {
    var overlay = document.getElementById('regQuickOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  function saveQuickEntry() {
    var entryId = _quickModal.entryId;
    if (!entryId) return;
    var r = Registro.getById(entryId);
    if (!r) return;

    var notaRaw = document.getElementById('regQuickNota').value.trim();
    var nota    = notaRaw !== '' ? parseFloat(notaRaw) : null;
    if (nota !== null && (isNaN(nota) || nota < 0 || nota > 10)) {
      Toast.show('La nota debe estar entre 0 y 10', 'error'); return;
    }
    var horas  = parseFloat(document.getElementById('regQuickHoras').value) || null;
    var estado = document.getElementById('regQuickEstado').value;

    Registro.update(entryId, { estado: estado, nota: nota, horas: horas });
    Toast.show('Entrada actualizada ✓');
    closeQuickModal();
    renderTable();

    if (estado === 'Terminado' || estado === 'Platinado') {
      var game = Biblioteca.getById(r.juegoId);
      showCelebration(game ? game.titulo : '—', r.jugador);
    }
  }

  /* ── CELEBRATION (fuegos artificiales) ─────────────────────── */
  function showCelebration(gameTitle, playerKey) {
    safe(playCelebrationSound, 'sound');
    var playerColor = playerKey === 'David' ? '#3b82f6' :
                      playerKey === 'Javi'  ? '#9b1742' : '#9b59ff';
    var overlay = document.createElement('div');
    overlay.id = 'celebrationOverlay';
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
    requestAnimationFrame(function() { overlay.classList.add('show'); });
    var stopFW = launchFireworks(document.getElementById('celebFireworks'));
    function closeIt() {
      overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.5s';
      if (stopFW) stopFW();
      setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 520);
    }
    overlay.addEventListener('click', closeIt);
    setTimeout(closeIt, 6000);
  }

  function playCelebrationSound() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx = new AudioCtx();
    var melody = [
      { freq: 523.25, t: 0,    dur: 0.18 },
      { freq: 659.25, t: 0.16, dur: 0.18 },
      { freq: 783.99, t: 0.32, dur: 0.18 },
      { freq: 1046.5, t: 0.50, dur: 0.55 }
    ];
    var now = ctx.currentTime;
    melody.forEach(function(n) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(n.freq, now + n.t);
      gain.gain.setValueAtTime(0, now + n.t);
      gain.gain.linearRampToValueAtTime(0.35, now + n.t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.dur);
      osc.start(now + n.t); osc.stop(now + n.t + n.dur + 0.05);
    });
  }

  function launchFireworks(canvas) {
    var W = canvas.width = window.innerWidth;
    var H = canvas.height = window.innerHeight;
    var ctx = canvas.getContext('2d');
    var parts = []; var rafId = null; var stopped = false;
    var COLORS = ['#ff6b6b','#ffd700','#4facfe','#00f2fe','#f093fb','#43e97b','#fa709a','#fff4b2','#a8edea'];
    function burst(x, y) {
      var color = COLORS[Math.floor(Math.random() * COLORS.length)];
      var count = 70 + Math.floor(Math.random() * 40);
      for (var i = 0; i < count; i++) {
        var angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.3;
        var speed = 2.5 + Math.random() * 5.5;
        parts.push({ x:x, y:y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed - 1,
          life:1, decay:0.012+Math.random()*0.012, size:2.5+Math.random()*2.5, color:color });
      }
    }
    var burstCount = 0; var maxBursts = 14;
    function scheduleBurst() {
      if (stopped || burstCount >= maxBursts) return;
      burstCount++;
      burst(W*0.15 + Math.random()*W*0.7, H*0.08 + Math.random()*H*0.55);
      if (burstCount < maxBursts) setTimeout(scheduleBurst, 250 + Math.random()*350);
    }
    scheduleBurst(); setTimeout(scheduleBurst, 100); setTimeout(scheduleBurst, 220);
    function tick() {
      ctx.fillStyle = 'rgba(7,7,15,0.18)'; ctx.fillRect(0, 0, W, H);
      parts = parts.filter(function(p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.vx *= 0.985; p.life -= p.decay;
        if (p.life <= 0) return false;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
        ctx.restore(); return true;
      });
      if (!stopped && (parts.length > 0 || burstCount < maxBursts)) rafId = requestAnimationFrame(tick);
    }
    tick();
    return function stop() { stopped = true; if (rafId) cancelAnimationFrame(rafId); };
  }

  /* ── RENDER ROW ─────────────────────────────────────────── */
  /* ── VISTA: pestañas En curso / Completados / Mejores notas / Abandonados ── */
  var CURSO = { Jugando: 1, Retomar: 1 }, OTROS = { Abandonado: 1 }; // el resto cuenta como completado
  var PCOLOR = { David: '#3b82f6', Javi: '#ec4899', Mery: '#a855f7' };
  var esc = function (s) { return Utils.escapeHtml(s == null ? '' : String(s)); };

  function av(j) {
    return /^(David|Javi|Mery)$/.test(j)
      ? '<img class="rg-av" src="cara_' + j.toLowerCase() + '.png" alt="' + j + '" title="' + j + '" style="--pc:' + PCOLOR[j] + '">'
      : '<span class="rg-av">' + esc((j || '?').charAt(0)) + '</span>';
  }
  function cover(game, w) {
    return game && game.portadaUrl
      ? '<img src="' + esc(Utils.thumb(game.portadaUrl, w)) + '" alt="" loading="lazy" style="object-position:' + esc(game.portadaPos || 'center top') + '" onerror="this.style.display=\'none\'">'
      : '<span class="rg-ph">' + esc(game ? game.titulo.charAt(0) : '?') + '</span>';
  }
  function when(r) { return (Utils.monthName(r.mes) || '').slice(0, 3) + ' ' + r.año; }
  function plat(p) { return p ? '<span class="badge badge-plat ' + Utils.platformClass(p) + '">' + esc(p) + '</span>' : ''; }
  function nota(r) {
    if (r.nota === null || r.nota === undefined || r.nota === '') return '<span class="rg-nota rg-nota--none">—</span>';
    return '<span class="rg-nota" style="color:' + Utils.scoreColor(r.nota) + '">' + Utils.formatScore(r.nota) + '</span>';
  }
  function byDate(a, b) { return (a.año - b.año) || (a.mes - b.mes); }

  // En curso: una fila por juego, con todos los que lo están jugando
  function cursoRows(list, max) {
    var games = {}, order = [];
    list.forEach(function (r) { if (!games[r.juegoId]) { games[r.juegoId] = []; order.push(r.juegoId); } games[r.juegoId].push(r); });
    return order.slice(0, max || order.length).map(function (id) {
      var rs = games[id], game = Biblioteca.getById(id), r0 = rs[0];
      var titulo = game ? game.titulo : '(Juego eliminado)';
      var horas = Math.max.apply(null, rs.map(function (r) { return parseFloat(r.horas) || 0; }));
      var dur = game && parseFloat(game.duracion);
      // progreso aproximado: horas jugadas frente a la duración estimada del juego
      var pct = dur ? Math.min(100, Math.round(horas / dur * 100)) : 0;
      var plats = rs.map(function (r) { return r.plataformaJugada; }).filter(function (p, i, a) { return p && a.indexOf(p) === i; });
      return '<div class="rg-row">' +
        '<button type="button" class="rg-row__cover" onclick="window.GT.GameDetailModal.open(\'' + esc(id) + '\')" title="Ver ficha">' + cover(game, 420) + '</button>' +
        '<div class="rg-row__t"><b>' + esc(titulo) + '</b><small>' + (r0.estado === 'Retomar' ? '🔁 Para retomar' : '🎮 Jugando') + ' · desde ' + when(r0) + '</small></div>' +
        '<div class="rg-row__p">' + plats.map(plat).join('') + '</div>' +
        '<div class="rg-row__prog">' +
          (dur && horas ? '<div class="rg-prog__n"><b>' + pct + '%</b><span>' + (horas ? horas + 'h' : '0h') + ' / ~' + dur + 'h</span></div><div class="rg-prog"><i style="width:' + pct + '%"></i></div>'
               : '<div class="rg-prog__n"><b>' + (horas ? horas + 'h' : '—') + '</b><span>' + (horas ? 'jugadas' : (dur ? 'dura ~' + dur + 'h' : 'sin horas')) + '</span></div>') +
        '</div>' +
        '<div class="rg-row__who">' + rs.map(function (r) { return '<button type="button" class="rg-who" onclick="window.GT_Reg.openEdit(\'' + r.id + '\')" title="Editar la partida de ' + esc(r.jugador) + '">' + av(r.jugador) + '</button>'; }).join('') +
          '<small>' + (rs.length > 1 ? 'Jugando juntos' : esc(r0.jugador)) + '</small></div>' +
        '<button type="button" class="rg-row__go" onclick="window.GT_Reg.openQuickModal(\'' + r0.id + '\')" title="Actualizar rápido (estado, nota, horas)">›</button>' +
      '</div>';
    }).join('');
  }

  function card(r) {
    var game = Biblioteca.getById(r.juegoId), titulo = game ? game.titulo : '(Juego eliminado)';
    var mark = r.estado === 'Platinado' ? '🏆' : '✓';
    return '<div class="rg-card' + (r.estado === 'Platinado' ? ' rg-card--plat' : '') + '">' +
      '<button type="button" class="rg-card__cover" onclick="window.GT.GameDetailModal.open(\'' + esc(r.juegoId) + '\')" title="Ver ficha">' + cover(game, 420) +
        '<span class="rg-card__ok" title="' + esc(r.estado) + '">' + mark + '</span>' + av(r.jugador) + '</button>' +
      '<div class="rg-card__b">' +
        '<b title="' + esc(titulo) + '">' + esc(titulo) + '</b>' +
        '<small>📅 ' + when(r) + (r.horas ? ' · ' + r.horas + 'h' : '') + '</small>' +
        '<div class="rg-card__f">' + plat(r.plataformaJugada) + nota(r) +
          '<button type="button" class="rg-card__ed" onclick="window.GT_Reg.openEdit(\'' + r.id + '\')" title="Editar">✏️</button></div>' +
      '</div></div>';
  }

  function topList(list, n) {
    var conNota = list.filter(function (r) { return r.nota !== null && r.nota !== undefined && r.nota !== ''; })
      .sort(function (a, b) { return b.nota - a.nota; }).slice(0, n);
    if (!conNota.length) return '<p class="rg-none">Aún no hay notas</p>';
    return '<ol class="rg-top">' + conNota.map(function (r, i) {
      var game = Biblioteca.getById(r.juegoId);
      return '<li><span class="rg-top__n">' + (i + 1) + '</span>' +
        '<button type="button" class="rg-top__c" onclick="window.GT.GameDetailModal.open(\'' + esc(r.juegoId) + '\')">' + cover(game, 200) + '</button>' +
        '<span class="rg-top__t"><b>' + esc(game ? game.titulo : '(Juego eliminado)') + '</b><small>' + av(r.jugador) + esc(r.jugador) + ' · ' + when(r) + '</small></span>' + nota(r) + '</li>';
    }).join('') + '</ol>';
  }

  function section(cls, icon, title, count, body, more) {
    return '<section class="rg-sec rg-sec--' + cls + '"><div class="rg-sec__h"><h2>' + icon + ' ' + title + '</h2><span class="rg-sec__n">' + count + '</span>' +
      (more ? '<button type="button" class="rg-sec__more" data-goto="' + more + '">Ver todos →</button>' : '') + '</div>' + body + '</section>';
  }

  // contadores del lateral (jugadores y plataformas) con el año y el mes elegidos
  function renderSide(base) {
    document.querySelectorAll('#playerCards [data-count]').forEach(function (el) {
      var p = el.dataset.count, n = base.filter(function (r) { return p === 'All' || r.jugador === p; }).length;
      el.textContent = n + ' juego' + (n !== 1 ? 's' : '');
    });
    var mine = base.filter(function (r) { return state.player === 'All' || r.jugador === state.player; }), plats = {};
    mine.forEach(function (r) { var p = r.plataformaJugada || 'Otras'; plats[p] = (plats[p] || 0) + 1; });
    document.getElementById('regPlats').innerHTML = Object.keys(plats).sort(function (a, b) { return plats[b] - plats[a]; }).map(function (p) {
      return '<button type="button" class="rg-plat' + (state.plat === p ? ' is-on' : '') + '" data-plat="' + esc(p) + '"><span>' + esc(p) + '</span><b>' + plats[p] + '</b></button>';
    }).join('');
  }

  function renderTable() {
    var opts = {};
    if (state.year)  opts.año = state.year;
    if (state.month) opts.mes = parseInt(state.month);
    var base = Registro.filter(Object.assign({ jugador: 'All' }, opts));
    renderSide(base);
    var mineFilter = function (r) {
      return (state.player === 'All' || r.jugador === state.player) && (!state.plat || (r.plataformaJugada || 'Otras') === state.plat);
    };
    // lo que se está jugando sale aunque se empezara otro año o mes
    var entries = base.filter(function (r) { return !CURSO[r.estado] && mineFilter(r); })
      .concat(Registro.getAll().filter(function (r) { return CURSO[r.estado] && mineFilter(r); }));

    var container = document.getElementById('regContainer'), empty = document.getElementById('regEmpty');
    document.getElementById('regCount').textContent = entries.length + ' entrada' + (entries.length !== 1 ? 's' : '');
    if (!entries.length) { container.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    var dir = state.sortAsc ? 1 : -1;
    var curso = entries.filter(function (r) { return CURSO[r.estado]; }).sort(function (a, b) { return dir * byDate(a, b); });
    var otros = entries.filter(function (r) { return OTROS[r.estado]; }).sort(function (a, b) { return dir * byDate(a, b); });
    var hecho = entries.filter(function (r) { return !CURSO[r.estado] && !OTROS[r.estado]; }).sort(function (a, b) { return dir * byDate(a, b); });

    var t = state.tab, html = '';
    var cursoHtml = curso.length ? '<div class="rg-rows">' + cursoRows(curso, t ? 0 : 6) + '</div>' : '<p class="rg-none">Nadie está jugando nada ahora mismo</p>';
    if (!t || t === 'curso') html += section('curso', '🎮', 'EN CURSO', curso.length, cursoHtml, t ? '' : 'curso');
    if (!t) {
      html += '<div class="rg-duo">' +
        section('hecho', '✅', 'COMPLETADOS', hecho.length, '<div class="rg-cards rg-cards--strip">' + hecho.slice(0, 12).map(card).join('') + '</div>', 'hecho') +
        section('top', '⭐', 'MEJORES NOTAS', '', topList(hecho, 5), 'top') +
      '</div>';
      if (otros.length) html += section('otros', '⏸️', 'ABANDONADOS', otros.length, '<div class="rg-cards">' + otros.slice(0, 6).map(card).join('') + '</div>', 'otros');
    }
    if (t === 'hecho') html += section('hecho', '✅', 'COMPLETADOS', hecho.length, hecho.length ? '<div class="rg-cards">' + hecho.map(card).join('') + '</div>' : '<p class="rg-none">Sin juegos completados</p>');
    if (t === 'top') html += section('top', '⭐', 'MEJORES NOTAS', '', topList(hecho, 20));
    if (t === 'otros') html += section('otros', '⏸️', 'ABANDONADOS', otros.length, otros.length ? '<div class="rg-cards">' + otros.map(card).join('') + '</div>' : '<p class="rg-none">Ningún juego abandonado</p>');
    container.innerHTML = html;
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('#regTabs [data-tab]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
    renderTable();
  }
  function initTabs() {
    document.getElementById('regTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
    document.getElementById('regContainer').addEventListener('click', function (e) { var b = e.target.closest('[data-goto]'); if (b) { setTab(b.dataset.goto); scrollTo({ top: 0, behavior: 'smooth' }); } });
    document.getElementById('regPlats').addEventListener('click', function (e) {
      var b = e.target.closest('[data-plat]'); if (!b) return;
      state.plat = state.plat === b.dataset.plat ? '' : b.dataset.plat; // segundo clic quita el filtro
      renderTable();
    });
  }

  /* ── YEAR OPTIONS ───────────────────────────────────────── */
  function buildYearOptions() {
    var sel = document.getElementById('filterYear');
    if (!sel) return;
    // Build year list from actual registro entries
    var yearSet = {};
    Registro.getAll().forEach(function(r) { if (r.año) yearSet[r.año] = true; });
    var years = Object.keys(yearSet).map(Number).sort(function(a, b) { return b - a; });
    if (!years.length) years = [new Date().getFullYear()];
    var currentYear = new Date().getFullYear();
    var defaultYear = years.indexOf(currentYear) !== -1 ? currentYear : years[0];
    sel.innerHTML = '<option value="">Todos</option>' +
      years.map(function(y) {
        return '<option value="' + y + '"' + (y === defaultYear ? ' selected' : '') + '>' + y + '</option>';
      }).join('');
    state.year = defaultYear;
    sel.addEventListener('change', function() { state.year = this.value ? parseInt(this.value) : 0; renderTable(); });
  }

  /* ── POPULATE GAME SELECT ───────────────────────────────── */
  function populateGameSelect(selectedId) {
    var games = Biblioteca.getAll().sort(function(a, b) { return a.titulo.localeCompare(b.titulo, 'es'); });
    var sel = document.getElementById('fJuego');
    sel.innerHTML = '<option value="">— Seleccionar juego —</option>' +
      games.map(function(g) {
        return '<option value="' + g.id + '"' + (g.id === selectedId ? ' selected' : '') + '>' + Utils.escapeHtml(g.titulo) + '</option>';
      }).join('');
    // Sincronizar buscador: si hay un juego seleccionado, rellenar el input
    var search = document.getElementById('fJuegoSearch');
    if (search) {
      var selOpt = sel.options[sel.selectedIndex];
      search.value = (selectedId && selOpt && selOpt.value) ? selOpt.text : '';
    }
  }

  /* ── GAME SEARCH FILTER ──────────────────────────────────── */
  function initGameSearch() {
    var search = document.getElementById('fJuegoSearch');
    var sel    = document.getElementById('fJuego');
    if (!search || !sel) return;
    search.addEventListener('input', function() {
      var q = this.value.toLowerCase().trim();
      var opts = sel.querySelectorAll('option');
      opts.forEach(function(opt) {
        if (!opt.value) { opt.hidden = false; return; } // mantener placeholder
        opt.hidden = q.length > 0 && opt.text.toLowerCase().indexOf(q) === -1;
      });
      // Si solo queda un resultado visible, seleccionarlo automáticamente
      var visible = Array.from(opts).filter(function(o) { return o.value && !o.hidden; });
      if (visible.length === 1) sel.value = visible[0].value;
      else if (q === '') sel.value = '';
    });
    // Al elegir del select, actualizar el input
    sel.addEventListener('change', function() {
      var opt = this.options[this.selectedIndex];
      if (opt && opt.value) search.value = opt.text;
    });
  }

  /* ── MODAL OPEN ─────────────────────────────────────────── */
  function openAdd() {
    state.editId = null;
    var now = new Date();
    document.getElementById('entryModalTitle').textContent = 'Nueva Entrada';
    document.getElementById('entryEditId').value = '';
    populateGameSelect('');
    var srch = document.getElementById('fJuegoSearch');
    if (srch) { srch.value = ''; /* limpiar buscador */ }
    document.getElementById('fJugador').value = state.player !== 'All' ? state.player : 'David';
    document.getElementById('fEstado').value = 'Terminado';
    document.getElementById('fNota').value = '';
    document.getElementById('fHoras').value = '';
    document.getElementById('fMes').value = now.getMonth() + 1;
    document.getElementById('fAño').value = now.getFullYear();
    document.getElementById('fPlataformaJugada').value = '';
    document.getElementById('fComentario').value = '';
    document.getElementById('entryBtnDelete').style.display = 'none';
    document.getElementById('entryModal').classList.add('open');
    document.getElementById('fJuego').focus();
  }

  function openEdit(id) {
    var r = Registro.getById(id);
    if (!r) return;
    state.editId = id;
    document.getElementById('entryModalTitle').textContent = 'Editar Entrada';
    document.getElementById('entryEditId').value = id;
    populateGameSelect(r.juegoId);
    document.getElementById('fJugador').value = r.jugador;
    document.getElementById('fEstado').value = r.estado;
    document.getElementById('fNota').value = (r.nota !== null && r.nota !== undefined) ? r.nota : '';
    document.getElementById('fHoras').value = r.horas || '';
    document.getElementById('fMes').value = r.mes;
    document.getElementById('fAño').value = r.año;
    document.getElementById('fPlataformaJugada').value = r.plataformaJugada || '';
    document.getElementById('fComentario').value = r.comentario || '';
    document.getElementById('entryBtnDelete').style.display = 'inline-flex';
    document.getElementById('entryModal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('entryModal').classList.remove('open');
  }

  /* ── SAVE / DELETE ──────────────────────────────────────── */
  function saveEntry() {
    var juegoId = document.getElementById('fJuego').value;
    if (!juegoId) { Toast.show('Selecciona un videojuego', 'error'); return; }

    var notaRaw = document.getElementById('fNota').value.trim();
    var nota = notaRaw !== '' ? parseFloat(notaRaw) : null;
    if (nota !== null && (isNaN(nota) || nota < 0 || nota > 10)) {
      Toast.show('La nota debe estar entre 0 y 10', 'error'); return;
    }

    var data = {
      juegoId:          juegoId,
      jugador:          document.getElementById('fJugador').value,
      estado:           document.getElementById('fEstado').value,
      nota:             nota,
      horas:            parseFloat(document.getElementById('fHoras').value) || null,
      mes:              parseInt(document.getElementById('fMes').value),
      año:              parseInt(document.getElementById('fAño').value),
      plataformaJugada: document.getElementById('fPlataformaJugada').value,
      comentario:       document.getElementById('fComentario').value.trim()
    };

    if (state.editId) {
      Registro.update(state.editId, data);
      Toast.show('Entrada actualizada ✓');
    } else {
      Registro.add(data);
      Toast.show('Entrada añadida ✓');
    }

    closeModal();
    // alta: la caché aún no tiene la entrada; el listener de Firestore repinta al recibirla
    if (state.editId) renderTable();
  }

  function deleteEntry() {
    if (!state.editId) return;
    if (!confirm('¿Eliminar esta entrada del registro?')) return;
    Registro.remove(state.editId);
    Toast.show('Entrada eliminada');
    closeModal();
    renderTable();
  }

  /* ── PLAYER CARDS ───────────────────────────────────────── */
  function initPlayerCards() {
    document.getElementById('playerCards').querySelectorAll('input[type="radio"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        if (this.checked) {
          state.player = this.value;
          renderTable();
        }
      });
    });
  }

  /* ── INIT ───────────────────────────────────────────────── */
  function init() {
    var _ny = document.getElementById('navYear'); if (_ny) _ny.textContent = new Date().getFullYear();
    var fy = document.getElementById('footerYear'); if (fy) fy.textContent = new Date().getFullYear();

    /* Pre-select active player from localStorage */
    var ap = window.GT.getActivePlayer ? window.GT.getActivePlayer() : null;
    if (ap && ap !== 'All') {
      state.player = ap;
      var radio = document.querySelector('#playerCards input[value="' + ap + '"]');
      if (radio) radio.checked = true;
    }

    buildYearOptions();
    initPlayerCards();

    document.getElementById('filterMonth').addEventListener('change', function() { state.month = this.value; renderTable(); });
    initTabs();

    document.getElementById('btnSortOrder').addEventListener('click', function() {
      state.sortAsc = !state.sortAsc;
      this.textContent = state.sortAsc ? '↑ Enero→Dic' : '↓ Más reciente';
      renderTable();
    });

    injectQuickModal();

    initGameSearch();

    var _btnAddEntry = document.getElementById('btnAddEntry');
    if (_btnAddEntry) _btnAddEntry.addEventListener('click', openAdd);
    document.getElementById('fabAdd').addEventListener('click', openAdd);

    document.getElementById('entryModalClose').addEventListener('click', closeModal);
    document.getElementById('entryBtnCancel').addEventListener('click', closeModal);
    document.getElementById('entryBtnSave').addEventListener('click', saveEntry);
    document.getElementById('entryBtnDelete').addEventListener('click', deleteEntry);
    document.getElementById('entryModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });

    renderTable();
  }

  window.GT_Reg = { openEdit: openEdit, openQuickModal: openQuickModal };
  document.addEventListener('DOMContentLoaded', function () {
    window.GT.onDataReady(function () {
      safe(init, 'init');
      window.GT.onDataChange(function () { safe(renderTable, 'renderTable'); });
    });
  });
})();
