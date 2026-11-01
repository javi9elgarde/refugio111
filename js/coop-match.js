/* Empareja los títulos de la lista de cooperativos con los juegos de la Biblioteca.
   Los nombres no siempre se escriben igual («Helldivers II» / «Helldivers 2», «40.000» / «40,000»…),
   así que se comparan normalizados y, si no coinciden del todo, por palabras en común. */
(function (root) {
  'use strict';
  var ROMAN = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };

  function norm(t) {
    return String(t || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/(\d)[.,](\d{3})/g, '$1$2')     // 40.000 → 40000
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ').trim()
      .split(' ').map(function (w) { return ROMAN[w] || w; }).join(' ');
  }
  var STOP = { the: 1, of: 1, a: 1, la: 1, el: 1, de: 1, una: 1, lo: 1, and: 1, y: 1, to: 1 };
  function words(t) { return norm(t).split(' ').filter(function (w) { return w && !STOP[w]; }); }

  // 1 = igual; si no, proporción de palabras de la lista que están en el título de la biblioteca
  function score(query, title) {
    var q = norm(query), t = norm(title);
    if (!q || !t) return 0;
    if (q === t || q.replace(/ /g, '') === t.replace(/ /g, '')) return 1; // «Plate Up!» = «PlateUp!»
    if (t.indexOf(q + ' ') === 0 || q.indexOf(t + ' ') === 0) return 0.9;
    var qw = words(query), tw = words(title);
    if (!qw.length || !tw.length) return 0;
    var hit = qw.filter(function (w) { return tw.indexOf(w) !== -1; }).length;
    var back = tw.filter(function (w) { return qw.indexOf(w) !== -1; }).length;
    return Math.min(hit / qw.length, back / tw.length) * 0.85;
  }

  // «Valheim / Sons of Valhalla» son dos juegos: se busca cada uno
  function parts(item) { return item.split(/\s+\/\s+/).map(function (s) { return s.replace(/\bstyle\b/i, '').trim(); }).filter(Boolean); }

  // para cada título de la lista: los mejores candidatos (score ≥ 0.5)
  function match(list, games) {
    return list.map(function (item) {
      var found = [];
      parts(item).forEach(function (q) {
        var best = games.map(function (g) { return { g: g, s: score(q, g.titulo) }; })
          .filter(function (x) { return x.s >= 0.5; })
          .sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
        best.forEach(function (x) { if (!found.some(function (f) { return f.g.id === x.g.id; })) found.push(x); });
      });
      return { item: item, cands: found };
    });
  }

  var api = { norm: norm, score: score, match: match };
  if (typeof module !== 'undefined') module.exports = api; else root.GT_CoopMatch = api;
})(this);
