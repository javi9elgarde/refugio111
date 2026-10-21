/* ============================================================
   GAMETRACKER — IGDB (vía proxy Cloudflare Worker con las claves de Twitch)
   ============================================================ */
window.GT = window.GT || {};
window.GT.Igdb = (function () {
  'use strict';

  var PROXY = 'https://refugio111-igdb.javi9play3.workers.dev';

  var GENRES = { 'Adventure':'Aventura', 'Role-playing (RPG)':'RPG', 'Shooter':'Shooter', 'Strategy':'Estrategia',
    'Real Time Strategy (RTS)':'Estrategia', 'Turn-based strategy (TBS)':'Estrategia', 'Tactical':'Estrategia',
    'Simulator':'Simulación', 'Puzzle':'Puzzle', 'Platform':'Plataformas', 'Racing':'Carreras', 'Indie':'Indie',
    "Hack and slash/Beat 'em up":'Hack and Slash', 'Horror':'Terror', 'Survival':'Supervivencia',
    'Stealth':'Sigilo', 'Action':'Acción', 'Sandbox':'Sandbox' };
  var PLATFORMS = { 'PC (Microsoft Windows)':'PC', 'PlayStation 5':'PS5', 'PlayStation 4':'PS4', 'PlayStation 3':'PS3',
    'PlayStation 2':'PS2', 'Xbox Series X|S':'Xbox Series X', 'Xbox One':'Xbox One', 'Xbox 360':'Xbox 360',
    'Nintendo Switch':'Nintendo Switch', 'Nintendo Switch 2':'Nintendo Switch 2' };

  function uniq(list) {
    return list.filter(function (v, i) { return v && list.indexOf(v) === i; });
  }

  /* Respuesta del proxy → campos de la biblioteca */
  function toGame(g) {
    return {
      titulo:           g.name || '',
      portadaUrl:       g.image || g.cover || '',
      desarrollador:    g.developer || '',
      fechaLanzamiento: g.released || '', // IGDB pone 31-dic cuando solo se conoce el año
      duracion:         g.hours || null,
      generos:          uniq((g.genres || []).map(function (x) { return GENRES[x]; })),
      plataformas:      uniq((g.platforms || []).map(function (x) { return PLATFORMS[x]; })),
      saga:             g.saga || ''
    };
  }

  /* Misma forma que GT.Rawg.lookup: la búsqueda ya trae todo, load() no hace otra petición */
  function lookup(q, size) {
    return fetch(PROXY + '/search?q=' + encodeURIComponent(q) + '&limit=' + size)
      .then(function (r) {
        if (!r.ok) throw new Error('IGDB ' + r.status);
        return r.json();
      })
      .then(function (list) {
        return list.map(function (g) {
          return {
            source: 'IGDB', name: g.name, year: (g.released || '').slice(0, 4),
            thumb: g.image || g.cover || '', popularity: g.popularity || 0,
            load: function () { return Promise.resolve(toGame(g)); }
          };
        });
      });
  }

  return { lookup: lookup, toGame: toGame };
})();
