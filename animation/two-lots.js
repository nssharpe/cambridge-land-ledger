/*
 * Two Lots: an explainer animation for the Cambridge Land Ledger.
 * Usage: <link rel="stylesheet" href="two-lots.css"> <script src="two-lots.js"></script>
 *        window.TwoLots.mount(document.getElementById('two-lots'));
 * No dependencies. Captions and numbers live in STORY below, which is also the
 * single source read by media/render_two_lots.py (video + SRT).
 */
(function () {
  'use strict';

  var STORY = /*STORY-JSON-START*/{
    "duration": 73,
    "model": {
      "cip": { "levy": 417100000, "rate0": 14.07, "rateLandOnly": 54.009 },
      "res": { "rate0": 6.67, "landRate21": 9.949, "bldgRate21": 4.974 },
      "lots": {
        "sqft": 10000, "landPsf": 120,
        "parking": { "land": 1200000, "bldg": 20000 },
        "building": { "land": 1200000, "bldg": 6790000 }
      },
      "homes": {
        "sqft": 5000, "landPsf": 240,
        "house": { "land": 1200000, "bldg": 1185000 },
        "condo": { "land": 150000, "bldg": 745000, "units": 6 }
      },
      "barMaxTax": 115000,
      "barMaxHome": 18000
    },
    "scenes": [
      {
        "id": 1, "short": "Two lots", "title": "Two lots, same land", "start": 0, "end": 12, "rest": 0, "restReduced": 11.9,
        "captions": [
          { "start": 0, "end": 6, "text": "Picture two lots side by side on a Cambridge main street, zoned for up to 6 stories." },
          { "start": 6, "end": 12, "text": "They're the same size with the same land value. One is a surface parking lot, and the other has 5 stories of shops and offices." }
        ],
        "note": "Illustrative example with two 10,000 sq ft lots, land valued at $120 per sq ft (the FY26 median for Cambridge retail parcels)."
      },
      {
        "id": 2, "short": "Today's tax", "title": "Today's tax", "start": 12, "end": 25, "rest": 15, "restReduced": 24.9,
        "captions": [
          { "start": 12, "end": 18.5, "text": "Right now the parking lot pays about $17,200 a year, and the building next door pays about $112,400." },
          { "start": 18.5, "end": 25, "text": "Most of that is for the building. The way it works today, you pay a lot for putting up a building and very little for just holding land." }
        ],
        "note": "Illustrative example, with both lots taxed at the FY26 Cambridge commercial rate of $14.07 per $1,000."
      },
      {
        "id": 3, "short": "Shift toward land", "title": "Shift toward land", "start": 25, "end": 42, "rest": 25, "restReduced": 41.9,
        "captions": [
          { "start": 25, "end": 31, "text": "Now let's shift the tax toward land by exempting part of every building's value, and raise the rate so revenue stays the same." },
          { "start": 31, "end": 37, "text": "If half of building value is exempt, the parking lot pays about $27,000 and the building about $102,600." },
          { "start": 37, "end": 42, "text": "If you only tax land, both lots pay about $64,800, and the commercial class still raises $417 million." }
        ],
        "note": "Rates per $1,000 from the Cambridge FY26 model are $14.07 today, $22.32 for land and $11.16 for buildings with half exempt, and $53.98 for land only. The commercial class raises $417 million in every case."
      },
      {
        "id": 4, "short": "Inside each class", "title": "In Cambridge, the shift stays inside each class", "start": 42, "end": 60, "rest": 45.5, "restReduced": 59.9,
        "captions": [
          { "start": 42, "end": 47, "text": "Massachusetts taxes homes and businesses as separate classes, so any shift stays inside each class." },
          { "start": 47, "end": 54, "text": "That means a house on a big lot pays about 12% more, and a condo in a 6-unit building on a similar lot pays about 14% less." },
          { "start": 54, "end": 60, "text": "So in Cambridge this mostly moves tax off condos and onto houses." }
        ],
        "note": "Illustrative, before the residential exemption. The FY26 residential rate is $6.67 per $1,000, and at 2:1 it's $9.95 for land and $4.97 for buildings. Cambridge medians at 2:1 are +12% for owner-occupied single-family homes and -14% for condos."
      },
      {
        "id": 5, "short": "What to do first", "title": "What to do first", "start": 60, "end": 73, "rest": 64.6, "restReduced": 67.9,
        "captions": [
          { "start": 60, "end": 64.5, "text": "The first step is getting land values right, starting with parking, commercial and condo land." },
          { "start": 64.5, "end": 68, "text": "After that, a state law that lets cities choose a land-weighted tax." },
          { "start": 68, "end": 73, "text": "I'd like Cambridge to go first, with a gentler version that keeps homeowners about even." }
        ],
        "note": "Based on Cambridge FY26 assessor data and tax rates, run through the Cambridge Land Ledger model."
      }
    ],
    "steps": [
      { "title": "Get land values right", "text": "Ask Assessing four questions: how commercial and residential land compare, how parking lots and vacant land are valued, how parking around shops, offices and labs is valued, and whether condo units can get their share of the land." },
      { "title": "A state option", "text": "Let cities that want a land-weighted tax opt in. Cambridge should go first once the courts weigh in and condo land values are published, with a gentler version that keeps homeowners about even." }
    ],
    "geom": {
      "building": { "x": 345, "y": 125, "w": 205, "h": 165, "dx": 24, "dy": 80, "floors": 5 },
      "house": { "x": 122, "y": 150, "w": 96, "h": 78, "dx": 10, "dy": 26, "floors": 2 },
      "condo": { "x": 352, "y": 122, "w": 196, "h": 168, "dx": 18, "dy": 56, "floors": 3 },
      "trees": [[70, 80, 22], [240, 90, 26], [70, 250, 20], [250, 255, 18], [170, 72, 16]]
    },
    "endCard": { "start": 68, "title": "Cambridge Land Ledger", "line": "Built by a Cambridge resident who lives in a condo." }
  }/*STORY-JSON-END*/;

  // ---------- model ----------
  var M = STORY.model;
  var GEOM = STORY.geom;
  var CIP_L = M.cip.levy / (M.cip.rateLandOnly / 1000);          // class land value
  var CIP_B = M.cip.levy / (M.cip.rate0 / 1000) - CIP_L;          // class building value
  function cipRate(f) { return M.cip.levy / (CIP_L + (1 - f) * CIP_B); } // $ per $ of taxable value
  function lotTax(lot, f) {
    var r = cipRate(f);
    return { land: r * lot.land, bldg: r * (1 - f) * lot.bldg, total: r * (lot.land + (1 - f) * lot.bldg) };
  }
  function homeTax(h, split) {
    var r = M.res;
    if (!split) { return (h.land + h.bldg) * r.rate0 / 1000; }
    return h.land * r.landRate21 / 1000 + h.bldg * r.bldgRate21 / 1000;
  }

  // ---------- helpers ----------
  function clamp(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function ease(x) { x = clamp(x); return x * x * (3 - 2 * x); }
  function prog(t, a, b) { return ease((t - a) / (b - a)); }
  function money(v) { return '$' + (Math.round(v / 100) * 100).toLocaleString('en-US'); }
  function millions(v) {
    if (v >= 1e6) { return '$' + (v / 1e6).toFixed(2).replace(/0$/, '') + 'M'; }
    return '$' + Math.round(v / 1000) + 'K';
  }
  function pct(a, b) { var p = (b / a - 1) * 100; return (p >= 0 ? '+' : '-') + Math.abs(p).toFixed(1) + '%'; }
  function fAt(t) {
    if (t < 28) { return 0; }
    if (t < 31) { return 0.5 * prog(t, 28, 31); }
    if (t < 37) { return 0.5; }
    return 0.5 + 0.5 * prog(t, 37, 39.5);
  }
  function sceneAt(t) {
    var s = STORY.scenes;
    for (var i = s.length - 1; i >= 0; i--) { if (t >= s[i].start) { return i; } }
    return 0;
  }
  function captionAt(sc, t) {
    var c = sc.captions;
    for (var i = c.length - 1; i >= 0; i--) { if (t >= c[i].start) { return c[i].text; } }
    return c[0].text;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent, text) {
    var n = document.createElement(tag);
    if (attrs) { for (var k in attrs) { if (k === 'class') { n.className = attrs[k]; } else { n.setAttribute(k, attrs[k]); } } }
    if (text != null) { n.textContent = text; }
    if (parent) { parent.appendChild(n); }
    return n;
  }
  function sv(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) { for (var k in attrs) { n.setAttribute(k, attrs[k]); } }
    if (parent) { parent.appendChild(n); }
    return n;
  }

  // ---------- SVG illustration (viewBox 600 x 380, no text inside) ----------
  function buildPlat(svg) {
    var g = {};
    sv('rect', { x: 0, y: 0, width: 600, height: 380, 'class': 'tl-ground' }, svg);
    // street
    sv('rect', { x: 0, y: 318, width: 600, height: 62, 'class': 'tl-street' }, svg);
    sv('line', { x1: 0, y1: 349, x2: 600, y2: 349, 'class': 'tl-street-line' }, svg);
    sv('line', { x1: 0, y1: 314, x2: 600, y2: 314, 'class': 'tl-curb' }, svg);

    // ----- commercial pair -----
    var com = sv('g', { 'class': 'tl-com' }, svg);
    g.com = com;
    // lots
    g.lotA = sv('rect', { x: 30, y: 40, width: 260, height: 268, 'class': 'tl-lot' }, com);
    g.lotB = sv('rect', { x: 310, y: 40, width: 260, height: 268, 'class': 'tl-lot' }, com);
    // parking: asphalt, stalls, cars
    sv('rect', { x: 42, y: 52, width: 236, height: 244, 'class': 'tl-asphalt' }, com);
    var stalls = sv('g', { 'class': 'tl-stalls' }, com);
    var cars = sv('g', { 'class': 'tl-cars' }, com);
    var rowsY = [60, 222];
    var carSpots = [[0, 1], [0, 3], [0, 4], [0, 7], [1, 0], [1, 2], [1, 5], [1, 6]];
    rowsY.forEach(function (y) {
      for (var i = 0; i <= 8; i++) { sv('line', { x1: 46 + i * 28.5, y1: y, x2: 46 + i * 28.5, y2: y + 66 }, stalls); }
    });
    carSpots.forEach(function (c) {
      sv('rect', { x: 46 + c[1] * 28.5 + 5, y: rowsY[c[0]] + 9, width: 18.5, height: 46, rx: 5, 'class': 'tl-car' }, cars);
    });
    sv('line', { x1: 60, y1: 159, x2: 260, y2: 159, 'class': 'tl-lane' }, com);
    // highlight outline for "review" in scene 5
    g.review = sv('rect', { x: 24, y: 34, width: 272, height: 280, rx: 6, 'class': 'tl-review' }, com);

    // building: oblique extrusion (roof offset up-left, street facade visible)
    var bld = sv('g', { 'class': 'tl-bld' }, com);
    g.bld = bld;
    drawBox(bld, GEOM.building, { shops: true });
    g.awning = null;

    // ----- residential pair -----
    var res = sv('g', { 'class': 'tl-res' }, svg);
    g.res = res;
    sv('rect', { x: 30, y: 40, width: 260, height: 268, 'class': 'tl-lot' }, res);
    sv('rect', { x: 310, y: 40, width: 260, height: 268, 'class': 'tl-lot' }, res);
    GEOM.trees.forEach(function (t) {
      sv('circle', { cx: t[0], cy: t[1], r: t[2], 'class': 'tl-tree' }, res);
    });
    var H = GEOM.house;
    sv('rect', { x: H.x + 28, y: H.y + H.h, width: 18, height: 308 - 4 - H.y - H.h, 'class': 'tl-path' }, res);
    drawBox(res, H, { ridge: true });
    drawBox(res, GEOM.condo, { units: 6 });
    return g;
  }

  // oblique box: footprint (x,y,w,h), roof shifted by (-dx,-dy); P(u,v) is a point on the street facade
  function drawBox(parent, b, o) {
    function P(u, v) { return [b.x + u * b.w - v * b.dx, b.y + b.h - v * b.dy]; }
    function poly(pts, cls) { sv('polygon', { points: pts.map(function (p) { return p.join(','); }).join(' '), 'class': cls }, parent); }
    sv('rect', { x: b.x, y: b.y, width: b.w, height: b.h, 'class': 'tl-footprint' }, parent);
    // right face
    poly([[b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x + b.w - b.dx, b.y + b.h - b.dy], [b.x + b.w - b.dx, b.y - b.dy]], 'tl-face-side');
    // street facade
    poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], 'tl-face-front');
    var n = b.floors;
    for (var i = 0; i < n; i++) {
      if (i > 0) { var a = P(0, i / n), c = P(1, i / n); sv('line', { x1: a[0], y1: a[1], x2: c[0], y2: c[1], 'class': 'tl-floorline' }, parent); }
      var cols = (o.shops && i === 0) ? 3 : Math.max(2, Math.round(b.w / 34));
      for (var k = 0; k < cols; k++) {
        var gap = 1 / cols, u0 = k * gap + gap * 0.18, u1 = (k + 1) * gap - gap * 0.18;
        var v0 = (i + 0.22) / n, v1 = (i + 0.78) / n;
        poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], (o.shops && i === 0) ? 'tl-shop' : 'tl-window');
      }
    }
    var rx = b.x - b.dx, ry = b.y - b.dy;
    sv('rect', { x: rx, y: ry, width: b.w, height: b.h, 'class': 'tl-roof' }, parent);
    if (o.ridge) { sv('line', { x1: rx, y1: ry + b.h / 2, x2: rx + b.w, y2: ry + b.h / 2, 'class': 'tl-ridge' }, parent); }
    if (o.units) {
      for (var u = 1; u < 3; u++) { sv('line', { x1: rx + u * b.w / 3, y1: ry, x2: rx + u * b.w / 3, y2: ry + b.h, 'class': 'tl-unitline' }, parent); }
      sv('line', { x1: rx, y1: ry + b.h / 2, x2: rx + b.w, y2: ry + b.h / 2, 'class': 'tl-unitline' }, parent);
    }
    if (o.shops) {
      // rooftop equipment
      sv('rect', { x: rx + 24, y: ry + 22, width: 40, height: 26, 'class': 'tl-rooftop' }, parent);
      sv('rect', { x: rx + b.w - 70, y: ry + 30, width: 46, height: 34, 'class': 'tl-rooftop' }, parent);
    }
  }

  // ---------- mount ----------
  function mount(root, opts) {
    if (!root) { throw new Error('TwoLots.mount: element required'); }
    opts = opts || {};
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (opts.reducedMotion != null) { reduce = !!opts.reducedMotion; }

    root.classList.add('two-lots');
    if (reduce) { root.classList.add('tl-reduced'); }
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Two lots: how a land-weighted property tax works, and what it would do in Cambridge');
    while (root.firstChild) { root.removeChild(root.firstChild); }

    var head = el('div', { 'class': 'tl-head' }, root);
    var kicker = el('p', { 'class': 'tl-kicker' }, head);
    var title = el('h2', { 'class': 'tl-title' }, head);

    var stage = el('div', { 'class': 'tl-stage' }, root);
    var platWrap = el('div', { 'class': 'tl-platwrap' }, stage);
    var svg = sv('svg', { viewBox: '0 0 600 380', 'class': 'tl-plat', role: 'img', focusable: 'false' }, platWrap);
    var svgTitle = sv('title', {}, svg);
    var g = buildPlat(svg);
    var tags = el('div', { 'class': 'tl-tags' }, platWrap);
    var tagA = el('p', { 'class': 'tl-tag' }, tags);
    var tagB = el('p', { 'class': 'tl-tag' }, tags);

    var panel = el('div', { 'class': 'tl-panel' }, stage);

    // commercial bars
    var comBox = el('div', { 'class': 'tl-bars tl-bars-com' }, panel);
    var comHead = el('p', { 'class': 'tl-bars-head' }, comBox);
    function barRow(parent, label) {
      var row = el('div', { 'class': 'tl-row' }, parent);
      el('p', { 'class': 'tl-row-label' }, row, label);
      var line = el('div', { 'class': 'tl-row-line' }, row);
      var track = el('div', { 'class': 'tl-track', 'aria-hidden': 'true' }, line);
      var segL = el('span', { 'class': 'tl-seg tl-seg-land' }, track);
      var segB = el('span', { 'class': 'tl-seg tl-seg-bldg' }, track);
      var val = el('span', { 'class': 'tl-val' }, line);
      return { row: row, segL: segL, segB: segB, val: val };
    }
    var rowP = barRow(comBox, 'Surface parking lot');
    var rowB = barRow(comBox, '5-story building, shops and offices');
    var legend = el('p', { 'class': 'tl-legend' }, comBox);
    el('span', { 'class': 'tl-key tl-key-land', 'aria-hidden': 'true' }, legend);
    el('span', {}, legend, 'Land ');
    el('span', { 'class': 'tl-key tl-key-bldg', 'aria-hidden': 'true' }, legend);
    el('span', {}, legend, 'Building');

    var sliderWrap = el('div', { 'class': 'tl-slider' }, comBox);
    var sliderLabel = el('label', { 'for': '' }, sliderWrap);
    var sliderId = 'tl-f-' + Math.random().toString(36).slice(2, 8);
    sliderLabel.setAttribute('for', sliderId);
    sliderLabel.textContent = 'Share of building value exempt';
    var slider = el('input', { type: 'range', min: '0', max: '100', step: '5', value: '0', id: sliderId }, sliderWrap);
    var sliderOut = el('p', { 'class': 'tl-slider-out' }, sliderWrap);
    var totals = el('p', { 'class': 'tl-totals' }, comBox);

    // residential bars
    var resBox = el('div', { 'class': 'tl-bars tl-bars-res' }, panel);
    el('p', { 'class': 'tl-bars-head' }, resBox, 'Tax per year, per home');
    function pairRow(parent, label) {
      var row = el('div', { 'class': 'tl-row' }, parent);
      var lab = el('p', { 'class': 'tl-row-label' }, row, label + ' ');
      var d = el('span', { 'class': 'tl-delta' }, lab);
      var l1 = el('div', { 'class': 'tl-row-line tl-has-sub' }, row);
      el('span', { 'class': 'tl-sub' }, l1, 'Today');
      var t1 = el('div', { 'class': 'tl-track', 'aria-hidden': 'true' }, l1);
      var s1 = el('span', { 'class': 'tl-seg tl-seg-today' }, t1);
      var v1 = el('span', { 'class': 'tl-val' }, l1);
      var l2 = el('div', { 'class': 'tl-row-line tl-has-sub' }, row);
      el('span', { 'class': 'tl-sub' }, l2, 'At 2:1');
      var t2 = el('div', { 'class': 'tl-track', 'aria-hidden': 'true' }, l2);
      var s2 = el('span', { 'class': 'tl-seg' }, t2);
      var v2 = el('span', { 'class': 'tl-val' }, l2);
      return { s1: s1, v1: v1, s2: s2, v2: v2, d: d, l2: l2 };
    }
    var rowH = pairRow(resBox, 'Single-family house, big lot');
    var rowC = pairRow(resBox, 'One home in a 6-unit condo building');
    var resNote = el('p', { 'class': 'tl-punch' }, resBox, 'So in Cambridge this mostly moves tax off condos and onto houses.');

    // next steps
    var nextBox = el('div', { 'class': 'tl-next' }, panel);
    var ol = el('ol', {}, nextBox);
    var stepEls = STORY.steps.map(function (s) {
      var li = el('li', {}, ol);
      el('strong', {}, li, s.title + '. ');
      el('span', {}, li, s.text);
      return li;
    });

    // end card
    var endCard = el('div', { 'class': 'tl-end' }, stage);
    endCard.style.display = 'none';   // the end card is for the video export, not the site
    el('p', { 'class': 'tl-end-title' }, endCard, STORY.endCard.title);
    el('p', { 'class': 'tl-end-line' }, endCard, STORY.endCard.line);

    var caption = el('p', { 'class': 'tl-caption', 'aria-live': 'polite' }, root);
    var note = el('p', { 'class': 'tl-note' }, root);

    // controls
    var controls = el('div', { 'class': 'tl-controls', role: 'group', 'aria-label': 'Animation controls' }, root);
    var playBtn = el('button', { type: 'button', 'class': 'tl-btn tl-btn-primary' }, controls, 'Play');
    var replayBtn = el('button', { type: 'button', 'class': 'tl-btn' }, controls, 'Replay');
    var prevBtn = el('button', { type: 'button', 'class': 'tl-btn', 'aria-label': 'Previous scene' }, controls, 'Back');
    var nextBtn = el('button', { type: 'button', 'class': 'tl-btn', 'aria-label': 'Next scene' }, controls, 'Next');
    var stepNav = el('div', { 'class': 'tl-steps', role: 'group', 'aria-label': 'Scenes' }, root);
    var stepBtns = STORY.scenes.map(function (s, i) {
      var b = el('button', { type: 'button', 'class': 'tl-step', 'aria-label': 'Scene ' + (i + 1) + ': ' + s.short }, stepNav);
      el('span', { 'class': 'tl-step-n' }, b, String(i + 1));
      el('span', { 'class': 'tl-step-t' }, b, s.short);
      b.addEventListener('click', function () { goScene(i); });
      return b;
    });
    var progress = el('div', { 'class': 'tl-progress', 'aria-hidden': 'true' }, root);
    var progressFill = el('span', {}, progress);

    // ---------- state ----------
    var t = 0, playing = false, last = 0, raf = 0, fOverride = null;
    var lastCaption = '', lastScene = -1;

    function render() {
      var si = sceneAt(t), sc = STORY.scenes[si];
      var isCom = si <= 2 || si === 4;
      root.setAttribute('data-scene', String(si + 1));

      if (si !== lastScene) {
        kicker.textContent = 'Scene ' + (si + 1) + ' of ' + STORY.scenes.length;
        title.textContent = sc.title;
        note.textContent = sc.note;
        stepBtns.forEach(function (b, i) {
          if (i === si) { b.setAttribute('aria-current', 'step'); } else { b.removeAttribute('aria-current'); }
        });
        prevBtn.setAttribute('aria-disabled', si === 0 ? 'true' : 'false');
        nextBtn.setAttribute('aria-disabled', si === STORY.scenes.length - 1 ? 'true' : 'false');
        lastScene = si;
      }

      // caption: in reduced-motion mode show the whole scene's narration
      var cap = reduce ? sc.captions.map(function (c) { return c.text; }).join(' ') : captionAt(sc, t);
      if (cap !== lastCaption) { caption.textContent = cap; lastCaption = cap; }

      g.com.style.display = isCom ? '' : 'none';
      g.res.style.display = isCom ? 'none' : '';
      comBox.style.display = si <= 2 ? '' : 'none';
      resBox.style.display = si === 3 ? '' : 'none';
      nextBox.style.display = si === 4 ? '' : 'none';

      var L = M.lots;
      if (isCom) {
        svgTitle.textContent = 'Plat map: a surface parking lot next to a 5-story building on two same-size lots facing a street.';
        tagA.textContent = 'Surface parking lot. Land ' + millions(L.parking.land) + ', paving ' + millions(L.parking.bldg) + '.';
        tagB.textContent = 'Shops and offices. Land ' + millions(L.building.land) + ', building ' + millions(L.building.bldg) + '.';
      } else {
        svgTitle.textContent = 'Plat map: a single-family house with a big yard next to a 6-unit condo building on a similar lot.';
        tagA.textContent = 'Single-family house. ' + M.homes.sqft.toLocaleString('en-US') + ' sq ft lot, land ' + millions(M.homes.house.land) + '.';
        tagB.textContent = '6-unit condo building. Similar lot, land ' + millions(M.homes.condo.land * M.homes.condo.units) + ' shared by 6 homes.';
      }

      // scene 5: highlight parking land for review
      g.review.style.opacity = si === 4 ? String(0.25 + 0.75 * (reduce ? 1 : prog(t, 60.2, 61.2))) : '0';
      g.review.style.display = si === 4 ? '' : 'none';

      if (si <= 2) {
        var f = 0, grow = 1, isTax = si >= 1;
        if (si === 1) { grow = reduce ? 1 : prog(t, 12.2, 14.5); }
        if (si === 2) { f = fOverride != null ? fOverride : fAt(t); }
        if (si === 0) {
          comHead.textContent = 'Assessed value';
        } else {
          comHead.textContent = 'Tax per year';
        }
        var tp = lotTax(L.parking, f), tb = lotTax(L.building, f);
        var max = M.barMaxTax;
        // scene 1 shows value on the same scale (value x today's rate), so bars carry over into scene 2
        var r0 = M.cip.rate0 / 1000;
        function setRow(row, tax, lot) {
          var wl = (si === 0 ? lot.land * r0 : tax.land * grow) / max * 100;
          var wb = (si === 0 ? lot.bldg * r0 : tax.bldg * grow) / max * 100;
          row.segL.style.width = wl.toFixed(2) + '%';
          row.segB.style.width = wb.toFixed(2) + '%';
          row.val.textContent = si === 0 ? millions(lot.land + lot.bldg) : (grow > 0 ? money(tax.total * grow) : '');
        }
        setRow(rowP, tp, L.parking);
        setRow(rowB, tb, L.building);
        rowB.row.classList.toggle('tl-emph', si === 1 && (reduce || t >= 18.5));
        sliderWrap.style.display = si === 2 ? '' : 'none';
        totals.style.display = si === 2 ? '' : 'none';
        g.bld.style.opacity = String(1 - 0.55 * f);
        if (si === 2) {
          var fp = Math.round(f * 100);
          if (document.activeElement !== slider) { slider.value = String(Math.round(f * 20) * 5); }
          slider.setAttribute('aria-valuetext', fp + ' percent of building value exempt');
          var ratio = f >= 0.999 ? 'land only' : (f < 0.001 ? 'one rate for land and buildings, as today' : 'land taxed at ' + (1 / (1 - f)).toFixed(1).replace(/\.0$/, '') + ' times the building rate');
          sliderOut.textContent = fp + '% exempt: ' + ratio + '.';
          totals.textContent = 'These two lots together: ' + money(tp.total + tb.total) + ' a year. Commercial class citywide: $417 million, unchanged.';
        }
      } else {
        g.bld.style.opacity = '1';
      }

      if (si === 3) {
        var a = reduce ? 1 : prog(t, 42.8, 45);
        var b = reduce ? 1 : prog(t, 47.3, 49.5);
        var H = M.homes, mx = M.barMaxHome;
        var h0 = homeTax(H.house, false), h1 = homeTax(H.house, true);
        var c0 = homeTax(H.condo, false), c1 = homeTax(H.condo, true);
        rowH.s1.style.width = (h0 * a / mx * 100).toFixed(2) + '%';
        rowC.s1.style.width = (c0 * a / mx * 100).toFixed(2) + '%';
        rowH.v1.textContent = money(h0 * a);
        rowC.v1.textContent = money(c0 * a);
        rowH.s2.style.width = (h1 * b / mx * 100).toFixed(2) + '%';
        rowC.s2.style.width = (c1 * b / mx * 100).toFixed(2) + '%';
        rowH.s2.className = 'tl-seg tl-seg-more';
        rowC.s2.className = 'tl-seg tl-seg-less';
        rowH.v2.textContent = b > 0 ? money(h1 * b) : '';
        rowC.v2.textContent = b > 0 ? money(c1 * b) : '';
        rowH.d.textContent = b >= 1 ? pct(h0, h1) + ' (pays more)' : '';
        rowC.d.textContent = b >= 1 ? pct(c0, c1) + ' (pays less)' : '';
        rowH.d.className = 'tl-delta tl-more';
        rowC.d.className = 'tl-delta tl-less';
        resNote.style.visibility = (reduce || t >= 54) ? 'visible' : 'hidden';
      }

      if (si === 4) {
        stepEls[0].style.visibility = (reduce || t >= 60.3) ? 'visible' : 'hidden';
        stepEls[1].style.visibility = (reduce || t >= 64.5) ? 'visible' : 'hidden';
        var endOn = !reduce && t >= STORY.endCard.start;
        endCard.classList.toggle('tl-on', endOn);
        endCard.style.opacity = endOn ? String(prog(t, 68, 69)) : '';
        endCard.setAttribute('aria-hidden', (reduce || endOn) ? 'false' : 'true');
      } else {
        endCard.classList.remove('tl-on');
        endCard.style.opacity = '';
        endCard.setAttribute('aria-hidden', 'true');
      }

      progressFill.style.width = (t / STORY.duration * 100).toFixed(2) + '%';
      playBtn.textContent = playing ? 'Pause' : (t >= STORY.duration ? 'Play again' : 'Play');
      playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    }

    function frame(now) {
      if (!playing) { return; }
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      if (t >= STORY.duration) { t = STORY.duration; playing = false; }
      render();
      if (playing) { raf = requestAnimationFrame(frame); }
    }
    function play() {
      if (reduce) { return; }
      if (t >= STORY.duration) { t = 0; }
      fOverride = null;
      playing = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      render();
    }
    function pause() { playing = false; cancelAnimationFrame(raf); render(); }
    function goScene(i) {
      i = Math.max(0, Math.min(STORY.scenes.length - 1, i));
      fOverride = null;
      var sc = STORY.scenes[i];
      if (reduce) { t = sc.restReduced; }
      else if (playing) { t = sc.start; }
      else { t = sc.rest; }
      render();
    }

    playBtn.addEventListener('click', function () { if (playing) { pause(); } else { play(); } });
    replayBtn.addEventListener('click', function () { t = 0; fOverride = null; if (reduce) { goScene(0); } else { play(); } });
    prevBtn.addEventListener('click', function () { if (prevBtn.getAttribute('aria-disabled') !== 'true') { goScene(sceneAt(t) - 1); } });
    nextBtn.addEventListener('click', function () { if (nextBtn.getAttribute('aria-disabled') !== 'true') { goScene(sceneAt(t) + 1); } });
    slider.addEventListener('input', function () {
      if (playing) { pause(); }
      fOverride = Number(slider.value) / 100;
      if (sceneAt(t) !== 2) { t = STORY.scenes[2].rest; }
      render();
    });

    if (reduce) { replayBtn.textContent = 'Start over'; t = STORY.scenes[0].restReduced; }
    render();

    return {
      play: play, pause: pause, goScene: goScene,
      seek: function (s) { t = Math.max(0, Math.min(STORY.duration, s)); render(); },
      destroy: function () { pause(); while (root.firstChild) { root.removeChild(root.firstChild); } }
    };
  }

  window.TwoLots = { mount: mount, story: STORY };
})();
