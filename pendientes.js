/* ============================================================
   GAMETRACKER — Jugadores / Perfiles Page
   Version: 20260525c
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

  /* ── State ─────────────────────────────────────────────────── */
  var _favs        = { David: [], Javi: [], Mery: [] };
  var _logros      = { David: [], Javi: [], Mery: [] };
  var _titulos     = {};
  var _favModal    = { playerKey: null, slotIdx: null };
  var _doneModal   = { gameId: null, playerKey: null };
  var _logrosPick  = { playerKey: null, selected: [] };
  var _LOGRO_DEFAULT = ['maratonista', 'platinero', 'completista', 'explorador'];

  function safe(fn, name) {
    try { fn(); } catch(e) { console.warn('pendientes.js ' + name + ':', e); }
  }

  /* ══════════════════════════════════════════════════════════════
     FAVORITES — Firebase I/O
  ══════════════════════════════════════════════════════════════ */
  function loadFavoritos(cb) {
    window.GT.db.collection('jugadores').get().then(function(snap) {
      snap.forEach(function(doc) {
        if (_favs.hasOwnProperty(doc.id)) {
          _favs[doc.id]   = doc.data().favoritos || [];
          _logros[doc.id] = doc.data().logrosSeleccionados || [];
          _titulos[doc.id] = doc.data().titulo || '';
        }
      });
      if (cb) cb();
    }).catch(function(e) {
      console.warn('loadFavoritos:', e);
      if (cb) cb();
    });
  }

  function saveFavoritos(playerKey) {
    window.GT.db.collection('jugadores').doc(playerKey)
      .set({ favoritos: _favs[playerKey] }, { merge: true })
      .catch(function(e) { console.warn('saveFavoritos:', e); });
  }

  function saveLogros(playerKey) {
    window.GT.db.collection('jugadores').doc(playerKey)
      .set({ logrosSeleccionados: _logros[playerKey] }, { merge: true })
      .catch(function(e) { console.warn('saveLogros:', e); });
  }

  /* ── OPEN / CLOSE PICKER ────────────────────────────────────── */
  function openFavPicker(playerKey, slotIdx) {
    _favModal.playerKey = playerKey;
    _favModal.slotIdx   = slotIdx;
    var player = PLAYERS.find(function(p) { return p.key === playerKey; });
    document.getElementById('favPickerTitle').textContent =
      'Favorito #' + (slotIdx + 1) + '  ·  ' + (player ? player.name : playerKey);
    var search = document.getElementById('favPickerSearch');
    search.value = '';
    renderPickerList('');
    document.getElementById('favPickerOverlay').classList.add('open');
    search.focus();
  }

  function closeFavPicker() {
    var el = document.getElementById('favPickerOverlay');
    if (el) el.classList.remove('open');
    _favModal.playerKey = null;
    _favModal.slotIdx   = null;
  }

  function renderPickerList(query) {
    var pk      = _favModal.playerKey;
    var already = (_favs[pk] || []).filter(Boolean);
    var games   = Biblioteca.getAll()
      .filter(function(g) {
        var free  = !already.includes(g.id);
        var match = !query || g.titulo.toLowerCase().includes(query.toLowerCase());
        return free && match;
      })
      .sort(function(a, b) { return a.titulo.localeCompare(b.titulo, 'es'); });

    var listEl = document.getElementById('favPickerList');
    if (!games.length) {
      listEl.innerHTML = '<div class="fav-picker-empty">No se encontraron juegos</div>';
      return;
    }
    listEl.innerHTML = games.map(function(g) {
      var safeId = g.id.replace(/'/g, "\\'");
      return '<div class="fav-picker-item" onclick="window.GT_Pend.pickFav(\'' + safeId + '\')">' +
        '<span>' + Utils.escapeHtml(g.titulo) + '</span>' +
        (g.fechaLanzamiento ? '<span class="fav-picker-year">' + g.fechaLanzamiento.slice(0,4) + '</span>' : '') +
      '</div>';
    }).join('');
  }

  function pickFav(gameId) {
    var pk = _favModal.playerKey;
    var si = _favModal.slotIdx;
    if (pk === null || si === null) return;
    var favs = (_favs[pk] || []).slice();
    while (favs.length < 12) favs.push(null);
    favs[si] = gameId;
    _favs[pk] = favs;
    saveFavoritos(pk);
    closeFavPicker();
    render();
  }

  function removeFav(playerKey, slotIdx) {
    var favs = (_favs[playerKey] || []).slice();
    while (favs.length < 12) favs.push(null);
    favs[slotIdx] = null;
    _favs[playerKey] = favs;
    saveFavoritos(playerKey);
    render();
  }

  /* ── INJECT PICKER MODAL (once) ─────────────────────────────── */
  function injectFavPicker() {
    if (document.getElementById('favPickerOverlay')) return;
    var el = document.createElement('div');
    el.id = 'favPickerOverlay';
    el.innerHTML =
      '<div class="fav-picker-box">' +
        '<div class="fav-picker-header">' +
          '<span id="favPickerTitle" class="fav-picker-title">Elige favorito</span>' +
          '<button class="modal__close" onclick="window.GT_Pend.closeFavPicker()">✕</button>' +
        '</div>' +
        '<input type="text" id="favPickerSearch" class="form-input" placeholder="🔍 Buscar juego..." ' +
          'oninput="window.GT_Pend.renderPickerList(this.value)" ' +
          'style="margin-bottom:0.6rem;width:100%;box-sizing:border-box">' +
        '<div id="favPickerList" class="fav-picker-list"></div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function(e) { if (e.target === el) closeFavPicker(); });
  }

  /* ══════════════════════════════════════════════════════════════
     LOGROS PICKER MODAL
  ══════════════════════════════════════════════════════════════ */
  function injectLogrosModal() {
    if (document.getElementById('logrosPickerOverlay')) return;
    var el = document.createElement('div');
    el.id = 'logrosPickerOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:3000;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.22s;backdrop-filter:blur(6px)';
    el.innerHTML =
      '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem;max-width:680px;width:95%;max-height:85vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem">' +
          '<div>' +
            '<div style="font-family:\'Orbitron\',sans-serif;font-size:0.9rem;font-weight:700" id="logrosPickerTitle">Elige tus 4 logros</div>' +
            '<div style="font-size:0.75rem;color:var(--txt3);margin-top:0.2rem">Selecciona exactamente 4 · Los que elijas aparecerán en tu perfil</div>' +
          '</div>' +
          '<button class="modal__close" onclick="window.GT_Pend.closeLogrosPicker()">✕</button>' +
        '</div>' +
        '<div id="logrosPickerGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:0.65rem;margin-bottom:1.1rem"></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:0.5rem">' +
          '<button class="btn btn-secondary" onclick="window.GT_Pend.closeLogrosPicker()">Cancelar</button>' +
          '<button class="btn btn-primary" id="logrosPickerSave">Guardar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function(e) { if (e.target === el) closeLogrosPicker(); });
    document.getElementById('logrosPickerSave').addEventListener('click', saveLogrosPick);
  }

  function openLogrosPicker(playerKey) {
    var player = PLAYERS.find(function(p) { return p.key === playerKey; });
    _logrosPick.playerKey = playerKey;
    _logrosPick.selected  = (_logros[playerKey].length ? _logros[playerKey] : _LOGRO_DEFAULT).slice();

    document.getElementById('logrosPickerTitle').textContent =
      'Elige 4 logros · ' + (player ? player.name : playerKey);

    renderLogrosPickerGrid(playerKey);

    var overlay = document.getElementById('logrosPickerOverlay');
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'all';
  }

  function closeLogrosPicker() {
    var overlay = document.getElementById('logrosPickerOverlay');
    if (overlay) { overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none'; }
    _logrosPick.playerKey = null;
    _logrosPick.selected  = [];
  }

  function renderLogrosPickerGrid(playerKey) {
    var player = PLAYERS.find(function(p) { return p.key === playerKey; });
    var color  = player ? player.color : 'var(--cyan)';
    // Compute all logros for this player to show in picker
    var all = _buildAllLogros(playerKey, color);
    var grid = document.getElementById('logrosPickerGrid');
    if (!grid) return;
    grid.innerHTML = all.map(function(l) {
      var isSel = _logrosPick.selected.indexOf(l.id) !== -1;
      return '<div class="lgr-pick-card' + (isSel ? ' lgr-pick-card--sel' : '') + '" ' +
        'onclick="window.GT_Pend.toggleLogroSel(\'' + l.id + '\')" ' +
        'style="--pp-color:' + color + '">' +
        '<div style="font-size:1.4rem;line-height:1;margin-bottom:0.3rem">' + l.emoji + '</div>' +
        '<div style="font-family:\'Rajdhani\',sans-serif;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--txt3);line-height:1;margin-bottom:0.15rem">' + Utils.escapeHtml(l.shortName) + '</div>' +
        '<div style="font-size:0.82rem;font-weight:700;color:' + (isSel ? color : 'var(--txt2)') + '">' + Utils.escapeHtml(String(l.value)) + '</div>' +
        (isSel ? '<div style="position:absolute;top:0.35rem;right:0.35rem;width:18px;height:18px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#07070f;font-weight:900">✓</div>' : '') +
      '</div>';
    }).join('');
  }

  function toggleLogroSel(logroId) {
    var idx = _logrosPick.selected.indexOf(logroId);
    if (idx !== -1) {
      _logrosPick.selected.splice(idx, 1);
    } else {
      if (_logrosPick.selected.length >= 4) {
        _logrosPick.selected.shift(); // quita el más antiguo
      }
      _logrosPick.selected.push(logroId);
    }
    renderLogrosPickerGrid(_logrosPick.playerKey);
  }

  function saveLogrosPick() {
    var pk = _logrosPick.playerKey;
    if (!pk) return;
    _logros[pk] = _logrosPick.selected.slice();
    saveLogros(pk);
    closeLogrosPicker();
    render();
  }

  /* ══════════════════════════════════════════════════════════════
     BUILD ALL LOGROS — computa todos los logros disponibles
  ══════════════════════════════════════════════════════════════ */
  function _buildAllLogros(key, color, year) {
    var entries     = Registro.filter({ jugador: key, año: year || null });
    var totalHoras  = Math.round(entries.reduce(function(acc, r) { return acc + (parseFloat(r.horas) || 0); }, 0));
    var platSeen = {}; var platCount = 0;
    entries.forEach(function(r) {
      if (r.estado === 'Platinado' && !platSeen[r.juegoId]) { platSeen[r.juegoId] = true; platCount++; }
    });
    var completados = new Set(
      entries.filter(function(r) { return r.estado === 'Terminado' || r.estado === 'Platinado' || r.estado === 'Rejugado' || r.estado === 'Jugado'; })
             .map(function(r) { return r.juegoId; })
    ).size;
    var rejugados = new Set(
      entries.filter(function(r) { return r.estado === 'Rejugado'; }).map(function(r) { return r.juegoId; })
    ).size;
    var genSet = {};
    entries.forEach(function(r) { var bg = Biblioteca.getById(r.juegoId); if (bg && bg.generos) bg.generos.forEach(function(g) { genSet[g] = true; }); });
    var totalGeneros = Object.keys(genSet).length;
    var scored = entries.filter(function(r) { return r.nota !== null && r.nota !== undefined && r.nota !== ''; });
    var avgScore = scored.length ? scored.reduce(function(a, r) { return a + parseFloat(r.nota); }, 0) / scored.length : null;
    var years = entries.map(function(r) { return r.año; }).filter(Boolean);
    var yearsActive = years.length ? (Math.max.apply(null, years) - Math.min.apply(null, years) + 1) : null;
    var conHoras = entries.filter(function(r) { return parseFloat(r.horas) > 0; })
      .sort(function(a, b) { return (parseFloat(b.horas)||0) - (parseFloat(a.horas)||0); });

    var all = [];

    if (conHoras.length) {
      var topR = conHoras[0]; var gR = Biblioteca.getById(topR.juegoId);
      all.push({
        id: 'maratonista', emoji: '🎮', shortName: 'Rey del Maratón',
        badge: '🎮 REY DEL MARATÓN', desc: 'Más horas en un único juego',
        bg: 'linear-gradient(160deg,#050d1f,#0b1c38)',
        visual: gR && gR.portadaUrl ? { type: 'cover', src: Utils.thumb(gR.portadaUrl), pos: gR.portadaPos || 'center top' } : { type: 'icon', icon: '🎮' },
        gameId: topR.juegoId,
        detail: gR ? gR.titulo : '—', value: topR.horas + 'h'
      });
    }
    all.push({
      id: 'platinero', emoji: '🏆', shortName: 'Platinero',
      badge: '🏆 PLATINERO', desc: 'Trofeos platino conseguidos',
      bg: 'linear-gradient(135deg,#020818,#060e2e)',
      visual: { type: 'trophy', src: 'platinum-trophy.png' },
      detail: platCount + (platCount !== 1 ? ' platinos' : ' platino'), value: platCount
    });
    all.push({
      id: 'completista', emoji: '✅', shortName: 'Completista',
      badge: '✅ COMPLETISTA', desc: 'Juegos completados o platinados',
      bg: 'linear-gradient(135deg,#041a0c,#082e14)',
      visual: { type: 'bigtext', text: completados + '', sub: completados !== 1 ? 'juegos' : 'juego' },
      detail: completados + (completados !== 1 ? ' juegos completados' : ' juego completado'), value: completados
    });
    all.push({
      id: 'explorador', emoji: '🌍', shortName: 'Explorador',
      badge: '🌍 EXPLORADOR', desc: 'Géneros distintos explorados',
      bg: 'linear-gradient(135deg,#031420,#04203a)',
      visual: { type: 'bigtext', text: totalGeneros + '', sub: totalGeneros !== 1 ? 'géneros' : 'género' },
      detail: totalGeneros + (totalGeneros !== 1 ? ' géneros distintos' : ' género distinto'),
      value: totalGeneros + (totalGeneros !== 1 ? ' géneros' : ' género')
    });
    if (avgScore !== null) {
      all.push({
        id: 'critico', emoji: '⭐', shortName: 'El Crítico',
        badge: '⭐ EL CRÍTICO', desc: 'Nota media de sus valoraciones',
        bg: 'linear-gradient(135deg,#1a0a00,#2e1500)',
        visual: { type: 'bigtext', text: avgScore.toFixed(1).replace('.', ','), sub: '/ 10' },
        detail: 'Media sobre ' + scored.length + (scored.length !== 1 ? ' valoraciones' : ' valoración'),
        value: avgScore.toFixed(1).replace('.', ',') + ' ★'
      });
    }
    if (rejugados > 0) {
      all.push({
        id: 'rejugador', emoji: '🔥', shortName: 'Rejugador',
        badge: '🔥 REJUGADOR', desc: 'Juegos completados más de una vez',
        bg: 'linear-gradient(135deg,#1a0505,#2e0808)',
        visual: { type: 'bigtext', text: rejugados + '', sub: rejugados !== 1 ? 'juegos' : 'juego' },
        detail: rejugados + (rejugados !== 1 ? ' juegos rejugados' : ' juego rejugado'), value: rejugados
      });
    }
    if (totalHoras > 0) {
      all.push({
        id: 'horas', emoji: '⏱', shortName: 'Maratonista',
        badge: '⏱ MARATONISTA', desc: 'Horas totales jugadas',
        bg: 'linear-gradient(135deg,#0d0522,#1c0d40)',
        visual: { type: 'bigtext', text: totalHoras + 'h', sub: 'en total' },
        detail: totalHoras + 'h totales registradas', value: totalHoras + 'h'
      });
    }
    if (yearsActive && yearsActive > 1) {
      all.push({
        id: 'veterano', emoji: '📅', shortName: 'Veterano',
        badge: '📅 VETERANO', desc: 'Años jugando en el Refugio',
        bg: 'linear-gradient(135deg,#0d0a1a,#1c1630)',
        visual: { type: 'bigtext', text: yearsActive + '', sub: yearsActive !== 1 ? 'años' : 'año' },
        detail: 'Desde ' + Math.min.apply(null, years) + ' hasta ' + Math.max.apply(null, years),
        value: yearsActive + (yearsActive !== 1 ? ' años' : ' año')
      });
    }

    /* ── La Nota Más Baja: puntuación individual más baja ─── */
    var conNotaMin = entries.filter(function(r){ return r.nota !== null && r.nota !== '' && r.nota !== undefined; })
                            .sort(function(a,b){ return parseFloat(a.nota) - parseFloat(b.nota); });
    if (conNotaMin.length) {
      var minEntry = conNotaMin[0];
      var minGame  = Biblioteca.getById(minEntry.juegoId);
      var minNota  = parseFloat(minEntry.nota).toFixed(1).replace('.', ',');
      all.push({
        id: 'nota_baja', emoji: '💀', shortName: 'Nota Más Baja',
        badge: '💀 LA NOTA MÁS BAJA', desc: 'La puntuación más baja que has puesto',
        bg: 'linear-gradient(160deg,#1a0505,#2e0808)',
        visual: minGame && minGame.portadaUrl
          ? { type: 'cover', src: minGame.portadaUrl, pos: minGame.portadaPos || 'center top' }
          : { type: 'bigtext', text: minNota, sub: '/ 10' },
        gameId: minGame ? minEntry.juegoId : null,
        detail: (minGame ? minGame.titulo : '—') + ' — ' + minNota + ' / 10',
        value: minNota + ' / 10'
      });
    }

    /* ── El Retro: juego más antiguo que ha jugado ────────── */
    var retroList = entries.map(function(r) {
      var g = Biblioteca.getById(r.juegoId);
      if (!g || !g.fechaLanzamiento) return null;
      var yr = parseInt((g.fechaLanzamiento + '').substring(0, 4));
      if (!yr || isNaN(yr)) return null;
      return { juegoId: r.juegoId, game: g, year: yr };
    }).filter(Boolean).sort(function(a, b) { return a.year - b.year; });
    if (retroList.length) {
      var retro = retroList[0];
      all.push({
        id: 'retro', emoji: '🕹️', shortName: 'El Retro',
        badge: '🕹️ EL RETRO', desc: 'El juego más antiguo que has jugado',
        bg: 'linear-gradient(160deg,#12080a,#251018)',
        visual: retro.game.portadaUrl
          ? { type: 'cover', src: retro.game.portadaUrl, pos: retro.game.portadaPos || 'center top' }
          : { type: 'bigtext', text: retro.year + '', sub: 'año' },
        gameId: retro.juegoId,
        detail: retro.game.titulo + ' (' + retro.year + ')',
        value: retro.year + ''
      });
    }

    return all;
  }

  /* ══════════════════════════════════════════════════════════════
     PLATINUM TROPHY SVG
  ══════════════════════════════════════════════════════════════ */
  /* PlayStation Platinum Trophy — imagen PNG oficial */
  var PLAT_SVG = '<img src="platinum-trophy.png" alt="Trofeo Platino PlayStation" ' +
    'style="width:88px;height:auto;filter:drop-shadow(0 0 14px rgba(80,150,255,0.6));display:block">';

  /* ══════════════════════════════════════════════════════════════
     RENDER PLAYER PROFILE
  ══════════════════════════════════════════════════════════════ */
  var _shownLogros = {}; // logros pintados, para abrir su detalle al pulsarlos
  // rango de cada logro, como los trofeos de PlayStation
  var TIER = { platinero: 'platino', horas: 'oro', completista: 'oro', maratonista: 'oro', critico: 'plata', explorador: 'plata', veterano: 'plata' };
  var TIER_TXT = { platino: 'PLATINO', oro: 'ORO', plata: 'PLATA', bronce: 'BRONCE' };

  function renderPlayer(player) {
    var key = player.key, esc = Utils.escapeHtml, M = Utils.miles;
    var color = (window.GT_JG && window.GT_JG.colors[key]) || player.color;
    var safeKey = key.replace(/'/g, "\\'");

    var entries = Registro.filter({ jugador: key });
    var totalJuegos = new Set(entries.map(function(r) { return r.juegoId; })).size;
    var totalHoras  = Math.round(entries.reduce(function(acc, r) { return acc + (parseFloat(r.horas) || 0); }, 0));
    var platCount = new Set(entries.filter(function(r) { return r.estado === 'Platinado'; }).map(function(r) { return r.juegoId; })).size;
    var notas = entries.filter(function(r) { return r.nota !== null && r.nota !== undefined && r.nota !== ''; });
    var media = notas.length ? notas.reduce(function(a, r) { return a + parseFloat(r.nota); }, 0) / notas.length : null;

    /* ── CABECERA: cara, nombre, título, cifras y medalla de logros ── */
    var kpi = function (val, lbl) { return '<div class="jp-kpi"><b>' + val + '</b><span>' + lbl + '</span></div>'; };
    var headHtml =
      '<header class="jp-head">' +
        '<img class="jp-av" src="cara_' + key.toLowerCase() + '.png" alt="">' +
        '<div class="jp-id"><h2>' + esc(player.name) + '</h2>' +
          '<p class="jp-title" contenteditable="plaintext-only" spellcheck="false" data-title="' + esc(key) + '" data-ph="Añade tu título…" title="Pulsa para editar tu título">' + esc(_titulos[key] || '') + '</p></div>' +
        '<div class="jp-kpis">' +
          kpi(M(totalJuegos), 'Juegos jugados') + kpi(M(totalHoras) + 'h', 'Horas totales') +
          kpi(media === null ? '—' : media.toFixed(2).replace('.', ','), 'Nota media') +
          '<div class="jp-kpi jp-kpi--plat"><img src="platinum-trophy.png" alt=""><b>' + M(platCount) + '</b><span>Platino' + (platCount !== 1 ? 's' : '') + '</span></div>' +
          '<button type="button" class="jp-medal" onclick="window.GT_Pend.openLogros(\'' + safeKey + '\')" title="Ver logros"><span>🏅</span><b>Logros</b></button>' +
        '</div>' +
      '</header>';

    /* ── MIS FAVORITOS: cuadros iguales en el orden elegido ─── */
    var favIds = _favs[key] || [], cells = [], free = -1, shown = 0;
    for (var i = 0; i < 12; i++) {
      var gameId = favIds[i];
      if (!gameId) { if (free < 0) free = i; continue; }
      var g = Biblioteca.getById(gameId);
      var h = Math.round(entries.filter(function(r) { return r.juegoId === gameId; }).reduce(function(a, r) { return a + (parseFloat(r.horas) || 0); }, 0));
      var safeGId = gameId.replace(/'/g, "\\'");
      shown++;
      cells.push('<div class="jp-fav jp-fav--filled" role="button" tabindex="0" title="Ver ficha: ' + esc(g ? g.titulo : '') + '" onclick="window.GT.GameDetailModal.open(\'' + safeGId + '\')">' +
        '<div class="jp-fav__pic">' + (g && g.portadaUrl ? '<img src="' + esc(Utils.thumb(g.portadaUrl, 640)) + '" style="object-position:' + esc(g.portadaPos || 'center center') + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') + '</div>' +
        '<div class="jp-fav__plate"><b>' + esc(g ? g.titulo : '(juego eliminado)') + '</b>' + (h ? '<span>⏱ ' + M(h) + ' h jugadas</span>' : '') + '</div>' +
        '<span class="jp-fav__ctl">' +
          '<button title="Mover a la izquierda" onclick="event.stopPropagation();window.GT_Pend.moveFav(\'' + safeKey + '\',' + i + ',-1)">‹</button>' +
          '<button title="Quitar" onclick="event.stopPropagation();window.GT_Pend.removeFav(\'' + safeKey + '\',' + i + ')">×</button>' +
          '<button title="Mover a la derecha" onclick="event.stopPropagation();window.GT_Pend.moveFav(\'' + safeKey + '\',' + i + ',1)">›</button>' +
        '</span>' +
      '</div>');
    }
    if (free >= 0) cells.push('<button type="button" class="jp-fav jp-fav--add" onclick="window.GT_Pend.openFavPicker(\'' + safeKey + '\',' + free + ')"><span>＋</span>Añadir favorito</button>');

    return '<div class="jp" id="player-' + key.toLowerCase() + '" style="--pc:' + color + '">' + headHtml +
      '<section class="jp-favs"><h3 class="jp-favs__h">MIS FAVORITOS</h3><div class="jp-gallery">' + cells.join('') + '</div></section>' +
    '</div>';
  }

  // cambia de sitio un favorito con el siguiente (o anterior) que haya
  function moveFav(key, i, dir) {
    var favs = (_favs[key] || []).slice();
    while (favs.length < 12) favs.push(null);
    for (var j = i + dir; j >= 0 && j < 12; j += dir) {
      if (!favs[j]) continue;
      var t = favs[i]; favs[i] = favs[j]; favs[j] = t;
      _favs[key] = favs; saveFavoritos(key); render();
      return;
    }
  }

  /* ── VENTANA DE LOGROS: general o de un año ──────────────── */
  function openLogros(key, year) {
    year = parseInt(year, 10) || 0;
    var esc = Utils.escapeHtml, M = Utils.miles, safeKey = key.replace(/'/g, "\\'");
    var color = (window.GT_JG && window.GT_JG.colors[key]) || '#f5c842';
    var years = Registro.filter({ jugador: key }).map(function(r) { return r.año; })
      .filter(function(y, i, a) { return y && a.indexOf(y) === i; }).sort(function(a, b) { return b - a; });
    var list = _buildAllLogros(key, color, year);
    var card = function (l) {
      var v = l.visual, tier = TIER[l.id] || 'bronce', art;
      _shownLogros[key + ':' + l.id] = l;
      if (v.type === 'cover' && v.src) art = '<img class="lg__cover" src="' + esc(Utils.thumb(v.src, 640)) + '" style="object-position:' + esc(v.pos || 'center top') + '" alt="">';
      else if (v.type === 'trophy') art = '<img class="lg__trophy" src="' + esc(v.src) + '" alt="">';
      else {
        var big = v.type === 'bigtext' ? (l.id === 'retro' ? String(v.text) : M(v.text)) : '';
        art = '<span class="lg__big' + (big.length > 4 ? ' lg__big--sm' : '') + '">' + esc(big) + (v.icon || '') + '</span>';
      }
      var click = l.gameId ? 'window.GT.GameDetailModal.open(\'' + l.gameId.replace(/'/g, "\\'") + '\')' : '';
      var tag = click ? 'button' : 'div';
      return '<' + tag + ' class="lg lg--' + tier + '"' + (click ? ' type="button" onclick="' + click + '" title="Ver ficha del juego"' : '') + '>' +
        '<span class="lg__art" style="background:' + l.bg + '">' + art + '<i class="lg__emoji">' + esc(l.emoji || '🏅') + '</i></span>' +
        '<span class="lg__txt"><small class="lg__tier">' + TIER_TXT[tier] + '</small><b>' + esc(l.shortName || l.badge) + '</b><em>' + esc(l.desc) + '</em>' +
          '<span class="lg__val">' + esc(l.id === 'retro' ? String(l.value) : M(l.value)) + '</span><small class="lg__det">' + esc(l.detail || '') + '</small></span>' +
      '</' + tag + '>';
    };
    window.GT_JG.modal('🏅 Logros de ' + key,
      '<div class="lgs-bar"><select class="jg-sel" onchange="window.GT_Pend.openLogros(\'' + safeKey + '\', this.value)">' +
        '<option value="0">General</option>' + years.map(function(y) { return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>'; }).join('') +
      '</select><span>' + list.length + ' logro' + (list.length !== 1 ? 's' : '') + (year ? ' en ' + year : ' en total') + '</span></div>' +
      (list.length ? '<div class="lgs">' + list.map(card).join('') + '</div>' : '<p class="lgs-none">Sin logros este año</p>'), 'wide');
  }

  /* ── RENDER ─────────────────────────────────────────────── */
  // en Jugadores se ve solo el elegido en el selector; en la página antigua, los tres
  function render() {
    var container = document.getElementById('playerProfiles');
    if (!container) return;
    var sel = window.GT_JG && window.GT_JG.player;
    var list = sel ? PLAYERS.filter(function(p) { return p.key === sel; }) : PLAYERS;
    container.innerHTML = list.map(renderPlayer).join('');
  }

  function saveTitulo(el) {
    var key = el.dataset.title, val = el.textContent.trim().slice(0, 60);
    if (val === (_titulos[key] || '')) return;
    _titulos[key] = val;
    window.GT.db.collection('jugadores').doc(key).set({ titulo: val }, { merge: true })
      .then(function() { Toast.show('Título guardado'); })
      .catch(function(e) { Toast.show('No se pudo guardar el título', 'error'); console.warn('saveTitulo:', e); });
  }
  document.addEventListener('focusout', function(e) { if (e.target.dataset && e.target.dataset.title) saveTitulo(e.target); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.title) { e.preventDefault(); e.target.blur(); } });
  document.addEventListener('gt:jugador', function() { if (window.GT.Biblioteca.getAll().length) safe(render, 'render'); });

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
      var gId = _doneModal.gameId; var pk = _doneModal.playerKey;
      closeDoneModal(); markFinished(gId, pk);
    });
    document.getElementById('pendDoneDiscard').addEventListener('click', function() {
      var gId = _doneModal.gameId; var pk = _doneModal.playerKey;
      closeDoneModal(); markDiscarded(gId, pk);
    });
  }

  function openDoneModal(gameId, playerKey) {
    var game = Biblioteca.getById(gameId);
    if (!game) return;
    _doneModal.gameId    = gameId;
    _doneModal.playerKey = playerKey;
    document.getElementById('pendDoneGameTitle').textContent = game.titulo;
    document.getElementById('pendDoneOverlay').classList.add('open');
  }

  function closeDoneModal() {
    var overlay = document.getElementById('pendDoneOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  /* ── ACTIONS ─────────────────────────────────────────────────── */
  function markDiscarded(gameId, playerKey) {
    var game = Biblioteca.getById(gameId);
    if (!game) return;
    var por = (game.pendientePor || []).filter(function(p) { return p !== playerKey; });
    Biblioteca.update(gameId, { pendientePor: por, pendiente: por.length > 0 });
    Toast.show('"' + game.titulo + '" eliminado de pendientes');
    render();
  }

  function markFinished(gameId, playerKey) {
    var game = Biblioteca.getById(gameId);
    if (!game) return;
    var por = (game.pendientePor || []).filter(function(p) { return p !== playerKey; });
    Biblioteca.update(gameId, { pendientePor: por, pendiente: por.length > 0 });
    showCelebration(game.titulo, playerKey);
    render();
  }

  /* ══════════════════════════════════════════════════════════════
     CELEBRATION
  ══════════════════════════════════════════════════════════════ */
  function showCelebration(gameTitle, playerKey) {
    safe(playVictorySound, 'sound');

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
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      if (stopFW) stopFW();
      setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 520);
    }
    overlay.addEventListener('click', closeIt);
    setTimeout(closeIt, 6000);
  }

  function playVictorySound() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx = new AudioCtx();
    var melody = [
      { freq: 523.25, t: 0,    dur: 0.18 },
      { freq: 659.25, t: 0.16, dur: 0.18 },
      { freq: 783.99, t: 0.32, dur: 0.18 },
      { freq: 1046.5, t: 0.50, dur: 0.55 }
    ];
    var chord = [
      { freq: 523.25, t: 0.50, dur: 0.55 },
      { freq: 659.25, t: 0.50, dur: 0.55 }
    ];
    function playNote(freq, startT, dur, vol) {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, startT);
      gain.gain.setValueAtTime(0, startT);
      gain.gain.linearRampToValueAtTime(vol, startT + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);
      osc.start(startT); osc.stop(startT + dur + 0.05);
    }
    var now = ctx.currentTime;
    melody.forEach(function(n) { playNote(n.freq, now + n.t, n.dur, 0.35); });
    chord.forEach(function(n)  { playNote(n.freq, now + n.t, n.dur, 0.18); });
    (function() {
      var buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      var src = ctx.createBufferSource(); var gain = ctx.createGain();
      src.buffer = buf; src.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      src.start(now); src.stop(now + 0.12);
    })();
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
        parts.push({ x: x, y: y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 1,
          life: 1, decay: 0.012 + Math.random()*0.012, size: 2.5 + Math.random()*2.5,
          color: color, trail: Math.random() > 0.5 });
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
        if (p.trail) { ctx.fillRect(p.x, p.y, p.size*p.life, p.size*p.life*0.4); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size*p.life, 0, Math.PI*2); ctx.fill(); }
        ctx.restore(); return true;
      });
      if (!stopped && (parts.length > 0 || burstCount < maxBursts)) rafId = requestAnimationFrame(tick);
    }
    tick();
    return function stop() { stopped = true; if (rafId) cancelAnimationFrame(rafId); };
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */
  function init() {
    var _ny = document.getElementById('navYear'); if (_ny) _ny.textContent = new Date().getFullYear();
    var _fy = document.getElementById('footerYear'); if (_fy) _fy.textContent = new Date().getFullYear();
    injectDoneModal();
    injectFavPicker();
    injectLogrosModal();
    render();
  }

  window.GT_Pend = {
    openDoneModal:     openDoneModal,
    openFavPicker:     openFavPicker,
    closeFavPicker:    closeFavPicker,
    renderPickerList:  renderPickerList,
    pickFav:           pickFav,
    removeFav:         removeFav,
    openLogrosPicker:  openLogrosPicker,
    closeLogrosPicker: closeLogrosPicker,
    toggleLogroSel:    toggleLogroSel,
    moveFav:           moveFav,
    openLogros:        openLogros,
    showLogro:         function (key, id) { var l = _shownLogros[key + ':' + id]; if (l && window.GT_JG) window.GT_JG.showLogro(l); }
  };

  document.addEventListener('DOMContentLoaded', function () {
    /* FAB → ir a biblioteca para añadir juego */
    var fab = document.getElementById('fabAddGame');
    if (fab) fab.addEventListener('click', function () {
      window.location.href = 'biblioteca.html?add=1';
    });

    window.GT.onDataReady(function () {
      loadFavoritos(function() {
        safe(init, 'init');
        window.GT.onDataChange(function () { safe(render, 'render'); });
      });
    });
  });
})();
