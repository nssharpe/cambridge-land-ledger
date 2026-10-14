/* Cambridge Land Ledger: canvas parcel map (d3-geo projection + d3-zoom; no tiles, no iframes). */
(function () {
  "use strict";

  var LAND = { bins: [100, 150, 200, 250, 300, 400, 600],
    colors: ["#440154", "#46327e", "#365c8d", "#277f8e", "#1fa187", "#4ac16d", "#a0da39", "#fde725"],
    labels: ["<$100", "100", "150", "200", "250", "300", "400", "600+"] };
  // bins spread taxable parcels across the ramp (taxable deciles run about 0.56 to 3.1); tax-exempt parcels are left blank
  var RATIO = { bins: [0.25, 0.5, 0.75, 1, 1.5, 2, 3],
    colors: ["#fde737", "#d9c757", "#b4a96b", "#918f73", "#737375", "#585d6e", "#3b496c", "#00224e"],
    labels: ["<0.25", "0.25", "0.5", "0.75", "1", "1.5", "2", "3+"] };
  var TAX = { bins: [-20, -5, -1, 1, 5, 20],
    colors: ["#2c5f9e", "#6f9ccf", "#bcd3ea", "#e9e6df", "#f3c99a", "#df8a3e", "#a8510a"],
    labels: ["≤−20%", "−20", "−5", "±1%", "+5", "+20", "≥+20%"] };
  // theme-dependent neutrals (fills only; never behind text)
  var NEUTRAL = {
    light: { none: "#dfe5e3", exempt: "#a9b3b6", parkBase: "#d9dfdd", parkTax: "#c75400", parkEx: "#0062a3", vacant: "#8e24aa", line: "#ffffff", street: "#7d898d" },
    dark:  { none: "#24333a", exempt: "#5b6a70", parkBase: "#2a3940", parkTax: "#ff8c42", parkEx: "#56b4e9", vacant: "#d59cf0", line: "#16232a", street: "#7f9298" }
  };
  var LABELS = {
    "4-8 apt": "Apartment building, 4 to 8 units", ">8 apt": "Apartment building, 9+ units",
    "Condo building": "Condo building", "No assessor record": "Street, rail or other land with no assessor record",
    "Tax-exempt": "Tax-exempt", "condo": "Condo unit", "gas/auto": "Gas station or auto use",
    "lab/R&D/high-tech": "Lab or R&D", "mixed-use com/ind": "Mixed use, mostly commercial",
    "mixed-use res": "Mixed use, mostly residential", "office": "Office", "office condo": "Office condo",
    "other": "Other", "parking garage": "Parking garage", "parking lot": "Parking lot",
    "restaurant/hotel": "Restaurant or hotel", "retail": "Retail store", "retail condo": "Retail condo",
    "retail/office": "Retail and office", "single-family": "Single-family house", "three-family": "Three-family house",
    "two-family": "Two-family house", "utility": "Utility", "vacant/developable land": "Vacant land",
    "warehouse/industrial": "Warehouse or industrial"
  };

  function binIndex(bins, v) { var i = 0; while (i < bins.length && v >= bins[i]) i++; return i; }
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  var money = function (v) { return "$" + Math.round(v).toLocaleString("en-US"); };

  function init(o) {
    var canvas = o.canvas, stage = o.stage, tip = o.tooltip, legendEl = o.legend, P = o.parcels, PK = o.parking, ST = o.streets;
    var streets = [];   // [{name, rank, pts: Float32Array of base-projected x,y}]
    var ctx = canvas.getContext("2d");
    var nF = P.geom.length, layer = "park", scen = null, scenLabel = "", hover = -1;
    var W = 0, H = 0, dpr = 1, transform = d3.zoomIdentity;
    var paths = [], bbox = new Float32Array(nF * 4), rings = [], grid = null, GC = 24, gw = 0, gh = 0;
    var parkPaths = { taxable: null, exempt: null };
    var VACANT = P.labels.indexOf("vacant/developable land"), nVacant = 0;
    for (var v = 0; v < P.lab.length; v++) if (P.lab[v] === VACANT && P.status[v] === 1) nVacant++;

    // lon/lat bounds for fitting (winding-independent)
    var minX = 180, minY = 90, maxX = -180, maxY = -90;
    P.geom.forEach(function (polys) { polys.forEach(function (r) { r[0].forEach(function (c) {
      if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0]; if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
    }); }); });

    function build() {
      var rect = stage.getBoundingClientRect();
      W = Math.max(200, Math.round(rect.width)); H = Math.max(160, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      var proj = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]],
        { type: "MultiPoint", coordinates: [[minX, minY], [maxX, maxY]] });
      paths = new Array(nF); rings = new Array(nF);
      gw = Math.ceil(W / GC); gh = Math.ceil(H / GC); grid = new Array(gw * gh);
      for (var f = 0; f < nF; f++) {
        var p2 = new Path2D(), fr = [], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        P.geom[f].forEach(function (poly) {
          poly.forEach(function (ring) {
            var arr = new Float32Array(ring.length * 2);
            for (var k = 0; k < ring.length; k++) {
              var xy = proj(ring[k]); arr[2 * k] = xy[0]; arr[2 * k + 1] = xy[1];
              if (k === 0) p2.moveTo(xy[0], xy[1]); else p2.lineTo(xy[0], xy[1]);
              if (xy[0] < x0) x0 = xy[0]; if (xy[0] > x1) x1 = xy[0]; if (xy[1] < y0) y0 = xy[1]; if (xy[1] > y1) y1 = xy[1];
            }
            p2.closePath(); fr.push(arr);
          });
        });
        paths[f] = p2; rings[f] = fr;
        bbox[4 * f] = x0; bbox[4 * f + 1] = y0; bbox[4 * f + 2] = x1; bbox[4 * f + 3] = y1;
        for (var gx = Math.max(0, Math.floor(x0 / GC)); gx <= Math.min(gw - 1, Math.floor(x1 / GC)); gx++) {
          for (var gy = Math.max(0, Math.floor(y0 / GC)); gy <= Math.min(gh - 1, Math.floor(y1 / GC)); gy++) {
            var gi = gy * gw + gx; (grid[gi] || (grid[gi] = [])).push(f);
          }
        }
      }
      ["taxable", "exempt"].forEach(function (k) {
        var p2 = new Path2D();
        (PK[k] || []).forEach(function (poly) { poly.forEach(function (ring) {
          ring.forEach(function (c, i) { var xy = proj(c); if (i === 0) p2.moveTo(xy[0], xy[1]); else p2.lineTo(xy[0], xy[1]); });
          p2.closePath();
        }); });
        parkPaths[k] = p2;
      });
      streets = [];
      if (ST) ST.lines.forEach(function (l) {
        var pts = new Float32Array(l[2].length * 2);
        l[2].forEach(function (c, i) { var xy = proj(c); pts[2 * i] = xy[0]; pts[2 * i + 1] = xy[1]; });
        streets.push({ name: l[0] >= 0 ? ST.names[l[0]] : "", rank: l[1], pts: pts });
      });
      zoom.extent([[0, 0], [W, H]]).translateExtent([[0, 0], [W, H]]);
      transform = d3.zoomIdentity;
      d3.select(canvas).call(zoom.transform, d3.zoomIdentity);
      draw();
    }

    function fillFor(f, N) {
      var st = P.status[f];
      if (layer === "land") {
        var v = P.lpsf[f]; return v == null ? N.none : LAND.colors[binIndex(LAND.bins, v)];
      }
      if (layer === "ratio") {
        if (st === 2) return N.none;
        var r = P.ratio[f]; return (r == null || st === 0) ? N.none : RATIO.colors[binIndex(RATIO.bins, r)];
      }
      if (layer === "park") return st === 0 ? N.none : (st === 1 && P.lab[f] === VACANT ? N.vacant : N.parkBase);
      if (layer === "tax") {
        if (st === 0) return N.none;
        if (st === 2 || !scen || !(scen.cur[f] > 0)) return N.exempt;
        return TAX.colors[binIndex(TAX.bins, (scen.now[f] - scen.cur[f]) / scen.cur[f] * 100)];
      }
      return N.none;
    }

    // vacant land is drawn as diagonal stripes so it reads apart from parking by pattern, not just hue
    function stripes(N, scale) {
      var t = document.createElement("canvas"); t.width = t.height = 8;
      var g = t.getContext("2d");
      g.fillStyle = N.parkBase; g.fillRect(0, 0, 8, 8);
      g.strokeStyle = N.vacant; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(6, 10); g.lineTo(10, 6); g.stroke();
      var pat = ctx.createPattern(t, "repeat");
      if (pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix().scale(1 / scale));
      return pat;
    }

    var pending = false;
    function requestDraw() { if (!pending) { pending = true; requestAnimationFrame(function () { pending = false; draw(); }); } }

    function draw() {
      var N = isDark() ? NEUTRAL.dark : NEUTRAL.light, k = transform.k;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = cssVar("--surface") || "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * transform.x, dpr * transform.y);
      // group by colour to limit state changes
      var byColor = {};
      for (var f = 0; f < nF; f++) { var c = fillFor(f, N); (byColor[c] || (byColor[c] = [])).push(f); }
      Object.keys(byColor).forEach(function (c) {
        ctx.fillStyle = (layer === "park" && c === N.vacant) ? stripes(N, dpr * k) : c;
        byColor[c].forEach(function (f) { ctx.fill(paths[f], "evenodd"); });
      });
      if (k >= 2.5) {           // parcel edges once zoomed in
        ctx.strokeStyle = N.line; ctx.lineWidth = 0.6 / k;
        for (f = 0; f < nF; f++) ctx.stroke(paths[f]);
      }
      drawStreetLines(N, k);
      if (layer === "park") {
        ctx.fillStyle = N.parkEx; ctx.fill(parkPaths.exempt, "evenodd");
        ctx.fillStyle = N.parkTax; ctx.fill(parkPaths.taxable, "evenodd");
      }
      if (hover >= 0) {
        ctx.strokeStyle = cssVar("--ink") || "#000"; ctx.lineWidth = 2 / k; ctx.stroke(paths[hover]);
      }
      drawStreetLabels(k);
    }

    // ---- streets: thin centerlines once zoomed in, names placed along straight stretches
    var MIN_K_LINES = [3, 1.6, 1.6], MIN_K_LABELS = [4.5, 2.4, 1.6];   // by rank: local, secondary, main
    function drawStreetLines(N, k) {
      if (!streets.length) return;
      ctx.strokeStyle = N.street; ctx.lineCap = "round"; ctx.lineJoin = "round";
      streets.forEach(function (s) {
        if (k < MIN_K_LINES[s.rank]) return;
        ctx.lineWidth = (s.rank === 2 ? 1.6 : 1) / k;
        ctx.beginPath();
        for (var i = 0; i < s.pts.length; i += 2) { if (i === 0) ctx.moveTo(s.pts[i], s.pts[i + 1]); else ctx.lineTo(s.pts[i], s.pts[i + 1]); }
        ctx.stroke();
      });
    }
    function drawStreetLabels(k) {
      if (!streets.length) return;
      var cands = streets.filter(function (s) { return s.name && k >= MIN_K_LABELS[s.rank]; });
      if (!cands.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var fs = 11 + (k > 8 ? 1 : 0);
      ctx.font = "600 " + fs + "px Archivo, Bahnschrift, 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var ink = cssVar("--ink") || "#000", halo = cssVar("--surface") || "#fff";
      var placed = [], lastByName = {};
      cands.sort(function (a, b) { return b.rank - a.rank || b.pts.length - a.pts.length; });
      cands.forEach(function (s) {
        var n = s.pts.length / 2, sx = new Float32Array(n), sy = new Float32Array(n), cum = new Float32Array(n), on = false;
        for (var i = 0; i < n; i++) {
          sx[i] = transform.x + s.pts[2 * i] * k; sy[i] = transform.y + s.pts[2 * i + 1] * k;
          if (sx[i] > -50 && sx[i] < W + 50 && sy[i] > -50 && sy[i] < H + 50) on = true;
          if (i) cum[i] = cum[i - 1] + Math.hypot(sx[i] - sx[i - 1], sy[i] - sy[i - 1]);
        }
        if (!on) return;
        var tw = ctx.measureText(s.name).width, need = tw + 12, L = cum[n - 1];
        if (L < need) return;
        function at(d) {
          var i = 1; while (i < n - 1 && cum[i] < d) i++;
          var t = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
          return [sx[i - 1] + (sx[i] - sx[i - 1]) * t, sy[i - 1] + (sy[i] - sy[i - 1]) * t];
        }
        var tries = [0.5], steps = Math.max(2, Math.min(12, Math.floor(L / need)));   // middle first, then spread out
        for (var z = 1; z < steps; z++) tries.push(z / steps);
        for (var q = 0; q < tries.length; q++) {
          var d = L * tries[q], d0 = d - need / 2, d1 = d + need / 2;
          if (d0 < 0 || d1 > L) continue;
          var a = at(d0), b = at(d1), dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
          if (len < tw + 4) continue;
          var straight = true;                     // every vertex in the window stays near the chord
          for (var j = 0; j < n && straight; j++) {
            if (cum[j] <= d0 || cum[j] >= d1) continue;
            if (Math.abs((sx[j] - a[0]) * dy - (sy[j] - a[1]) * dx) / len > 4.5) straight = false;
          }
          if (!straight) continue;
          var cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
          if (cx < 0 || cx > W || cy < 0 || cy > H) continue;
          var last = lastByName[s.name];
          if (last && last.some(function (p) { return Math.hypot(p[0] - cx, p[1] - cy) < 260; })) return;
          var ang = Math.atan2(dy, dx); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
          var hw = (Math.abs(Math.cos(ang)) * tw + Math.abs(Math.sin(ang)) * fs) / 2 + 3,
              hh = (Math.abs(Math.sin(ang)) * tw + Math.abs(Math.cos(ang)) * fs) / 2 + 3;
          var box = [cx - hw, cy - hh, cx + hw, cy + hh];
          if (placed.some(function (p) { return box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]; })) continue;
          placed.push(box); (lastByName[s.name] || (lastByName[s.name] = [])).push([cx, cy]);
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
          ctx.lineWidth = 3; ctx.strokeStyle = halo; ctx.lineJoin = "round"; ctx.strokeText(s.name, 0, 0.5);
          ctx.fillStyle = ink; ctx.fillText(s.name, 0, 0.5);
          ctx.restore();
          return;
        }
      });
    }

    function pip(x, y, arr) {
      var inside = false, n = arr.length / 2;
      for (var i = 0, j = n - 1; i < n; j = i++) {
        var xi = arr[2 * i], yi = arr[2 * i + 1], xj = arr[2 * j], yj = arr[2 * j + 1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }
    function hit(px, py) {
      var x = (px - transform.x) / transform.k, y = (py - transform.y) / transform.k;
      var gx = Math.floor(x / GC), gy = Math.floor(y / GC);
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return -1;
      var cand = grid[gy * gw + gx] || [];
      for (var i = 0; i < cand.length; i++) {
        var f = cand[i];
        if (x < bbox[4 * f] || x > bbox[4 * f + 2] || y < bbox[4 * f + 1] || y > bbox[4 * f + 3]) continue;
        var inside = false;
        rings[f].forEach(function (r) { if (pip(x, y, r)) inside = !inside; });
        if (inside) return f;
      }
      return -1;
    }

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function tipHTML(f) {
      var lab = P.labels[P.lab[f]], st = P.status[f], name = LABELS[lab] || lab, rows = [];
      if (lab === "Condo building") name = "Condo building, " + P.units[f] + " units";
      if (st === 2) name = "Tax-exempt parcel";
      if (P.lpsf[f] != null) rows.push(["Land value", "$" + Math.round(P.lpsf[f]).toLocaleString("en-US") + "/sq ft" + (P.est[f] ? " (est.)" : "")]);
      if (P.ratio[f] != null) rows.push(["Building per $1 of land", "$" + P.ratio[f].toFixed(2)]);
      var note = "";
      if (st === 1 && scen) {
        var a = scen.cur[f], b = scen.now[f];
        rows.push(["FY2026 tax", money(a)]);
        var pct = a > 0 ? (b - a) / a * 100 : 0;
        rows.push([scenLabel, money(b) + (a > 0 ? " (" + (pct >= 0 ? "+" : "−") + Math.abs(pct).toFixed(1) + "%)" : "")]);
        if (P.est[f]) note = "Condo land is estimated, since the City doesn't publish it.";
      } else if (st === 2) {
        note = "Pays no property tax, but the City still assesses its land.";
      }
      return '<span class="t-h">' + esc(name) + "</span><dl>" +
        rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl>" +
        (note ? '<span class="t-note">' + esc(note) + "</span>" : "");
    }
    function showTip(f, cx, cy) {
      if (f < 0) { tip.hidden = true; return; }
      tip.innerHTML = tipHTML(f); tip.hidden = false;
      var tw = tip.offsetWidth, th = tip.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var x = cx + 14, y = cy + 14;
      if (x + tw > vw - 8) x = Math.max(8, cx - tw - 14);
      if (y + th > vh - 8) y = Math.max(8, cy - th - 14);
      tip.style.left = x + "px"; tip.style.top = y + "px";
    }
    function pointer(ev) {
      var r = canvas.getBoundingClientRect();
      var f = hit(ev.clientX - r.left, ev.clientY - r.top);
      if (f !== hover) { hover = f; requestDraw(); }
      showTip(f, ev.clientX, ev.clientY);
    }
    canvas.addEventListener("pointermove", function (ev) { if (ev.pointerType === "mouse") pointer(ev); });
    canvas.addEventListener("click", pointer);
    canvas.addEventListener("pointerleave", function (ev) {
      if (ev.pointerType === "mouse") { hover = -1; tip.hidden = true; requestDraw(); }
    });
    window.addEventListener("scroll", function () { if (!tip.hidden) { tip.hidden = true; hover = -1; requestDraw(); } }, { passive: true });

    var zoom = d3.zoom().scaleExtent([1, 24])
      .filter(function (ev) {
        if (ev.type === "wheel") return ev.ctrlKey || ev.metaKey;
        if (ev.type.indexOf("touch") === 0) return ev.touches && ev.touches.length > 1;
        return !ev.button;
      })
      .on("zoom", function (ev) { transform = ev.transform; tip.hidden = true; requestDraw(); });
    d3.select(canvas).call(zoom).on("dblclick.zoom", null);

    function legend() {
      var html = "";
      function ramp(title, R, unit) {
        return '<span class="ttl">' + title + '</span><div class="ramp">' + R.colors.map(function (c, i) {
          return '<span class="sw"><i style="background:' + c + '"></i><span>' + R.labels[i] + (i === 0 && unit ? "" : "") + "</span></span>";
        }).join("") + "</div>";
      }
      var N = isDark() ? NEUTRAL.dark : NEUTRAL.light;
      if (layer === "land") html = ramp("Land value, $ per sq ft of parcel", LAND);
      if (layer === "ratio") html = ramp("Building value per $1 of land (low = little building on valuable land)", RATIO) +
        '<div class="keys" style="margin-top:6px"><span class="key"><i style="background:' + N.none + '"></i>Tax-exempt or no assessor record (left out)</span></div>';
      if (layer === "tax") html = ramp("Tax bill change. " + scenLabel, TAX) +
        '<div class="keys" style="margin-top:6px"><span class="key"><i style="background:' + N.exempt + '"></i>Tax-exempt</span></div>';
      if (layer === "park") html = '<span class="ttl">Surface parking (OpenStreetMap) and vacant land</span><div class="keys">' +
        '<span class="key"><i style="background:' + N.parkTax + '"></i>On taxable parcels (' + PK.acres.taxable + ' acres)</span>' +
        '<span class="key"><i style="background:' + N.parkEx + '"></i>On tax-exempt parcels (' + PK.acres.exempt + ' acres)</span>' +
        '<span class="key"><i style="background:repeating-linear-gradient(135deg,' + N.vacant + ' 0 3px,' + N.parkBase + ' 3px 6px)"></i>Vacant land, taxable (' + nVacant + ' parcels)</span>' +
        '<span class="key"><i style="background:' + N.parkBase + '"></i>Other parcels</span></div>';
      legendEl.innerHTML = html;
    }

    var ro = window.ResizeObserver ? new ResizeObserver(function () { build(); }) : null;
    if (ro) ro.observe(stage); else window.addEventListener("resize", build);
    window.addEventListener("ledger-theme", function () { legend(); draw(); });
    build(); legend();

    return {
      setLayer: function (l) { layer = l; legend(); draw(); },
      setScenario: function (s, label) { scen = s; scenLabel = label; if (layer === "tax") { legend(); } requestDraw(); },
      zoomBy: function (fac) { d3.select(canvas).call(zoom.scaleBy, fac, [W / 2, H / 2]); },
      reset: function () { d3.select(canvas).call(zoom.transform, d3.zoomIdentity); },
      _debug: function () { return { W: W, H: H, nF: nF, minX: minX, maxX: maxX, minY: minY, maxY: maxY }; }
    };
  }

  window.LedgerMap = { init: init, LABELS: LABELS };
})();
