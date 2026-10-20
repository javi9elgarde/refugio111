/* ============================================================
   GAMETRACKER — RAWG helper (compartido por biblioteca e importar)
   ============================================================ */
window.GT = window.GT || {};
window.GT.Rawg = (function () {
  'use strict';

  var KEY = 'c8cd3af7977b43b287e0a19389902880';

  var GENRES = { action:'Acción', adventure:'Aventura', 'role-playing-games-rpg':'RPG', shooter:'Shooter',
    strategy:'Estrategia', simulation:'Simulación', puzzle:'Puzzle', platformer:'Plataformas',
    racing:'Carreras', indie:'Indie' };
  var TAGS = { horror:'Terror', survival:'Supervivencia', roguelike:'Roguelike/Roguelite', roguelite:'Roguelike/Roguelite',
    metroidvania:'Metroidvania', soulslike:'Soulslike', 'souls-like':'Soulslike', stealth:'Sigilo', fps:'FPS',
    sandbox:'Sandbox', 'hack-and-slash':'Hack and Slash' };
  var PLATFORMS = { 'PC':'PC', 'PlayStation 5':'PS5', 'PlayStation 4':'PS4', 'PlayStation 3':'PS3',
    'PlayStation 2':'PS2', 'Xbox Series S/X':'Xbox Series X', 'Xbox One':'Xbox One', 'Xbox 360':'Xbox 360',
    'Nintendo Switch':'Nintendo Switch', 'Nintendo Switch 2':'Nintendo Switch 2' };

  function get(path, params) {
    return fetch('https://api.rawg.io/api/' + path + '?key=' + KEY + (params || ''))
      .then(function (r) {
        if (!r.ok) throw new Error('RAWG ' + r.status);
        return r.json();
      });
  }

  function search(q, size, ordering) {
    return get('games', '&search=' + encodeURIComponent(q) + '&page_size=' + size +
      (ordering ? '&ordering=' + ordering : '')).then(function (d) { return d.results || []; });
  }

  function detail(id) { return get('games/' + id); }

  function uniq(list) {
    return list.filter(function (v, i) { return v && list.indexOf(v) === i; });
  }

  /* RAWG (ficha de detalle o resultado de búsqueda) → campos de la biblioteca */
  function toGame(g) {
    return {
      titulo:           g.name || '',
      portadaUrl:       g.background_image || '',
      desarrollador:    (g.developers && g.developers[0]) ? g.developers[0].name : '',
      fechaLanzamiento: g.released || '',
      duracion:         g.playtime > 0 ? g.playtime : null, // shortcut: media de RAWG (no HowLongToBeat, sin API pública), editable a mano
      generos:          uniq((g.genres || []).map(function (x) { return GENRES[x.slug]; })
                        .concat((g.tags || []).map(function (x) { return TAGS[x.slug]; }))),
      plataformas:      uniq((g.platforms || []).map(function (x) { return PLATFORMS[x.platform.name]; }))
    };
  }

  return { search: search, detail: detail, toGame: toGame };
})();
