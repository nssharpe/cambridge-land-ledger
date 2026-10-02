/* Cambridge Land Ledger: page wiring (calculator, map link-up, cities, animation mount). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = "http://www.w3.org/2000/svg";
  var MINUS = "−";

  function fmtPct(v, dp) {
    if (v == null || isNaN(v)) return "n/a";
    var r = Number(v.toFixed(dp == null ? 1 : dp));
    if (r === 0) return (0).toFixed(dp == null ? 1 : dp) + "%";
    return (r > 0 ? "+" : MINUS) + Math.abs(r).toFixed(dp == null ? 1 : dp) + "%";
  }
  function fmtUsd(v) {
    var r = Math.round(v);
    if (r === 0) return "$0";
    return (r > 0 ? "+" : MINUS) + "$" + Math.abs(r).toLocaleString("en-US");
  }
  function cls(v) { return v > 0.05 ? "more" : v < -0.05 ? "less" : ""; }
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }

  // ------------------------------------------------------------ animation slot
  function mountAnimation() {
    var el = $("two-lots-animation");
    if (window.TwoLots && typeof window.TwoLots.mount === "function") {
      try { window.TwoLots.mount(el); } catch (e) { /* keep the static fallback */ }
    }
  }

  // ------------------------------------------------------------ land-by-use bar
  var BAR_COLORS = ["#1f5fa8", "#0e6655", "#6a3d9a", "#7fb2ea", "#4b5b62", "#4fc1a6", "#a8510a", "#f0a35a"];
  function landBar() {
    var rows = document.querySelectorAll("#landbar-table tbody tr"), bar = $("landbar");
    rows.forEach(function (tr, i) {
      var share = parseFloat(tr.children[2].textContent);
      var s = document.createElement("span");
      s.style.width = share + "%"; s.style.background = BAR_COLORS[i % BAR_COLORS.length];
      s.title = tr.children[0].textContent + ": " + tr.children[2].textContent;
      bar.appendChild(s);
      var key = document.createElement("i");
      key.setAttribute("aria-hidden", "true");
      key.style.cssText = "display:inline-block;width:12px;height:12px;margin-right:8px;border:1px solid var(--ink);vertical-align:-1px;background:" + BAR_COLORS[i % BAR_COLORS.length];
      tr.children[0].insertBefore(key, tr.children[0].firstChild);
    });
  }

  // ------------------------------------------------------------ calculator
  var D = null, map = null, nFeatures = 0;
  function state() {
    return {
      f: Number($("f-slider").value) / 100,
      coverage: document.querySelector('input[name="cov"]:checked').value,
      p: Number(document.querySelector('input[name="resex"]:checked').value)
    };
  }
  function ratioText(f) {
    if (f >= 0.999) return "Land only: buildings untaxed";
    if (f <= 0.001) return "Land and buildings taxed alike (1:1, today)";
    var k = 1 / (1 - f);
    var ks = Math.abs(k - Math.round(k)) < 0.005 ? String(Math.round(k)) : k.toFixed(2);
    return "Land taxed at " + ks + " times the building rate (" + ks + ":1)";
  }
  function scenLabel(s) {
    return "With " + Math.round(s.f * 100) + "% building exemption" + (s.coverage === "res" ? ", residential only" : "") + (s.p > 0.3 ? ", 35% res. exemption" : "");
  }

  function renderCalc() {
    var s = state(), r = LedgerCalc.compute(D, s), sum = LedgerCalc.summarize(D, r.tax);
    $("f-pct").textContent = Math.round(s.f * 100) + "%";
    $("f-ratio").textContent = ratioText(s.f);
    $("f-slider").setAttribute("aria-valuetext", Math.round(s.f * 100) + "% building exemption. " + ratioText(s.f));
    $("note-35").hidden = s.p < 0.33;
    $("note-both").hidden = s.coverage === "res" || s.f === 0;

    var per = function (v) { return "$" + (v * 1000).toFixed(2); };
    $("rates").innerHTML =
      "<dt>Residential rate per $1,000 (land / building)</dt><dd>" + per(r.rateRLand) + " / " + per(r.rateRBldg) + "</dd>" +
      "<dt>Commercial rate per $1,000 (land / building)</dt><dd>" + per(r.rateCLand) + " / " + per(r.rateCBldg) + "</dd>" +
      "<dt>Residential exemption (deducted from taxable value)</dt><dd>$" + Math.round(r.exemption).toLocaleString("en-US") + "</dd>";

    var tb = $("calc-table").querySelector("tbody");
    tb.innerHTML = "";
    sum.forEach(function (g) {
      var tr = document.createElement("tr");
      if (g.ref) tr.className = "ref";
      if (g.id === "oo_sf" || g.id === "condo") tr.classList.add("hl");
      var cells = [g.label, g.n.toLocaleString("en-US"), fmtPct(g.medianPct), fmtUsd(g.medianUsd),
                   isNaN(g.shareMore) ? "n/a" : Math.round(g.shareMore * 100) + "%"];
      cells.forEach(function (c, i) {
        var td = document.createElement(i === 0 ? "th" : "td");
        if (i === 0) td.scope = "row";
        td.textContent = c;
        if (i === 2 || i === 3) { var k = cls(i === 2 ? g.medianPct : g.medianUsd); if (k) td.className = k; }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    chart(sum);
    if (map) map.setScenario(LedgerCalc.byFeature(D, r.tax, nFeatures), scenLabel(s));
  }

  function chart(sum) {
    var host = $("calc-chart-svg"); host.innerHTML = "";
    var W = Math.max(300, host.clientWidth || 600), narrow = W < 520;
    var labW = narrow ? 0 : 230, rowH = narrow ? 40 : 26, top = 26, padR = 64, padL = narrow ? 52 : 12;
    var rows = sum.filter(function (g) { return !isNaN(g.medianPct); });
    var H = top + rows.length * rowH + 10;
    var mx = 10; rows.forEach(function (g) { mx = Math.max(mx, Math.abs(g.medianPct)); });
    mx = Math.ceil(mx / 10) * 10;
    var x0 = labW + padL, x1 = W - padR, sx = function (v) { return x0 + (v + mx) / (2 * mx) * (x1 - x0); };
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img",
                         "aria-label": "Bar chart of median percent change by group; the table above lists the same values." });
    [-mx, -mx / 2, 0, mx / 2, mx].forEach(function (v) {
      svg("line", { x1: sx(v), x2: sx(v), y1: top - 6, y2: H - 6, "class": v === 0 ? "zero" : "grid" }, s);
      var t = svg("text", { x: sx(v), y: 14, "text-anchor": "middle", "class": "t-muted" }, s);
      t.textContent = fmtPct(v, 0);
    });
    rows.forEach(function (g, i) {
      var y = top + i * rowH, v = g.medianPct, bx = Math.min(sx(0), sx(v)), bw = Math.abs(sx(v) - sx(0));
      var by = narrow ? y + 18 : y + 5, bh = narrow ? 14 : 15;
      if (narrow) { var lt = svg("text", { x: 4, y: y + 13 }, s); lt.textContent = g.label; }
      else { var lt2 = svg("text", { x: labW, y: y + 17, "text-anchor": "end" }, s); lt2.textContent = g.label; }
      svg("rect", { x: bx, y: by, width: Math.max(1, bw), height: bh, "class": v >= 0 ? "bar-more" : "bar-less" }, s);
      var vt = svg("text", { x: v >= 0 ? sx(v) + 4 : sx(v) - 4, y: by + bh - 3, "text-anchor": v >= 0 ? "start" : "end",
                              "class": v >= 0 ? "t-more" : "t-less" }, s);
      vt.textContent = fmtPct(v);
    });
    host.appendChild(s);
  }

  function wireCalc() {
    ["f-slider"].forEach(function (id) { $(id).addEventListener("input", renderCalc); });
    document.querySelectorAll('input[name="cov"], input[name="resex"]').forEach(function (el) { el.addEventListener("change", renderCalc); });
    $("calc-reset").addEventListener("click", function () {
      $("f-slider").value = 50; $("cov-both").checked = true; $("rx-30").checked = true; renderCalc();
    });
    var t = null;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(renderCalc, 150); });
  }

  // ------------------------------------------------------------ cities
  var CITY_NAMES = { cambridge: "Cambridge", worcester: "Worcester", springfield: "Springfield", fitchburg: "Fitchburg", leominster: "Leominster" };
  var CITY_COLS = [["SF owner-proxy", "Single-family, owner-occupied"], ["2-3F", "Two- and three-family"], ["Condo", "Condos"],
                   ["Apts 4+", "Apartments, 4+ units"], ["Vacant+parking", "Vacant and parking land"],
                   ["Retail (incl. restaurant)", "Retail and restaurants"], ["Office+industrial", "Office, lab and industrial"]];
  var citiesData = null;
  function cities(C) {
    citiesData = C;
    var rt = null;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { multiples(citiesData); }, 150); });
    var thead = $("cities-table").querySelector("thead"), tbody = $("cities-table").querySelector("tbody");
    var hr = document.createElement("tr");
    ["City"].concat(CITY_COLS.map(function (c) { return c[1]; })).concat(["Owner-occupied single-family, median $/yr"]).forEach(function (h) {
      var th = document.createElement("th"); th.scope = "col"; th.textContent = h; th.style.whiteSpace = "normal"; hr.appendChild(th);
    });
    thead.appendChild(hr);
    C.rows.forEach(function (r) {
      var tr = document.createElement("tr");
      if (r.city === "cambridge") tr.className = "hl";
      var th = document.createElement("th"); th.scope = "row";
      th.textContent = CITY_NAMES[r.city] + (r.scenario === "C50" ? " (pooled)" : "");
      tr.appendChild(th);
      CITY_COLS.forEach(function (c) {
        var td = document.createElement("td"), v = r[c[0]];
        td.textContent = fmtPct(v); var k = cls(v); if (k) td.className = k; tr.appendChild(td);
      });
      var td2 = document.createElement("td"); td2.textContent = fmtUsd(r.sf_oo_median_usd);
      var k2 = cls(r.sf_oo_median_usd); if (k2) td2.className = k2; tr.appendChild(td2);
      tbody.appendChild(tr);
    });
    multiples(C);
  }
  function multiples(C) {
    var host = $("multiples"); host.innerHTML = "";
    var rows = C.rows.filter(function (r) { return r.scenario === "A50"; });
    var cols = CITY_COLS.slice(0, 5), figs = cols.map(function (c) {
      var fig = document.createElement("figure"), cap = document.createElement("figcaption");
      cap.textContent = c[1]; fig.appendChild(cap); host.appendChild(fig);
      return fig;
    });
    var colW = figs[0].clientWidth;   // measure once every figure is in the grid
    cols.forEach(function (c, ci) {
      var fig = figs[ci];
      var W = Math.max(180, colW - 22), rowH = 24, labW = 78, H = rows.length * rowH + 22, padR = 50;
      var mx = 5; rows.forEach(function (r) { mx = Math.max(mx, Math.abs(r[c[0]])); });
      mx = Math.ceil(mx / 5) * 5;
      var hasNeg = rows.some(function (r) { return r[c[0]] < 0; }), hasPos = rows.some(function (r) { return r[c[0]] > 0; });
      var lo = hasNeg ? -mx : 0, hi = hasPos ? mx : 0;
      if (lo === hi) hi = 5;
      var x0 = labW + (hasNeg ? 34 : 4), x1 = W - padR;
      var sx = function (v) { return x0 + (v - lo) / (hi - lo) * (x1 - x0); };
      var s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, "aria-hidden": "true", focusable: "false" }, fig);
      svg("line", { x1: sx(0), x2: sx(0), y1: 2, y2: H - 18, "class": "zero", stroke: "currentColor" }, s).style.stroke = "var(--ink)";
      rows.forEach(function (r, i) {
        var v = r[c[0]], y = 4 + i * rowH;
        var t = svg("text", { x: 0, y: y + 13 }, s); t.textContent = CITY_NAMES[r.city];
        if (r.city === "cambridge") t.style.fontWeight = "700";
        var rect = svg("rect", { x: Math.min(sx(0), sx(v)), y: y + 3, width: Math.max(1, Math.abs(sx(v) - sx(0))), height: 13 }, s);
        rect.style.fill = v >= 0 ? "var(--more)" : "var(--less)";
        var vt = svg("text", { x: v >= 0 ? sx(v) + 3 : sx(v) - 3, y: y + 14, "text-anchor": v >= 0 ? "start" : "end" }, s);
        vt.textContent = fmtPct(v); vt.style.fill = v >= 0 ? "var(--more)" : "var(--less)";
      });
      var ax = svg("text", { x: sx(0), y: H - 4, "text-anchor": "middle" }, s); ax.textContent = "0"; ax.style.fill = "var(--muted)";
    });
  }

  // ------------------------------------------------------------ map layer controls
  var CAPTIONS = {
    land: "Land value per square foot of parcel area. Yellow marks the most valuable land. Tax-exempt parcels are shown too, because the City assesses their land.",
    ratio: "Assessed building value for each dollar of land value. Yellow parcels hold little building on their land: parking, vacant lots, gas stations and older low-rise buildings. Condo buildings use estimated land.",
    park: "Surface parking lots drawn in OpenStreetMap, clipped to Cambridge parcels. Orange lots sit on taxable parcels; blue lots sit on tax-exempt parcels such as universities. Volunteers draw this map, so some lots may be missing or out of date.",
    tax: "Change in each parcel's tax bill under the calculator's current settings. Condo buildings show the total for all units. Blue pays less, orange pays more."
  };
  function wireMap() {
    document.querySelectorAll('input[name="layer"]').forEach(function (el) {
      el.addEventListener("change", function () { if (map) map.setLayer(el.value); $("map-caption").textContent = CAPTIONS[el.value]; });
    });
    $("zoom-in").addEventListener("click", function () { if (map) map.zoomBy(1.6); });
    $("zoom-out").addEventListener("click", function () { if (map) map.zoomBy(1 / 1.6); });
    $("zoom-reset").addEventListener("click", function () { if (map) map.reset(); });
  }

  // ------------------------------------------------------------ boot
  function boot() {
    landBar();
    mountAnimation();
    wireMap();
    var msg = $("map-msg");
    var calcP = getJSON("data/calc.json").then(function (c) { D = LedgerCalc.prepare(c); wireCalc(); renderCalc(); });
    getJSON("data/cities.json").then(cities).catch(function () { /* table stays empty; text above carries the numbers */ });
    Promise.all([getJSON("data/parcels.json"), getJSON("data/parking.json"), calcP]).then(function (res) {
      if (!window.d3 || !d3.geoMercator) { msg.textContent = "The map library did not load. Check your connection and reload the page."; return; }
      nFeatures = res[0].geom.length;
      map = LedgerMap.init({ canvas: $("map-canvas"), stage: $("map-stage"), tooltip: $("tooltip"), legend: $("map-legend"),
                              parcels: res[0], parking: res[1] });
      msg.remove();
      renderCalc();
      var ql = null;
      try { ql = new URLSearchParams(location.search).get("layer"); } catch (e) { /* ignore */ }
      if (ql && CAPTIONS[ql]) { var inp = document.querySelector('input[name="layer"][value="' + ql + '"]'); if (inp) { inp.checked = true; inp.dispatchEvent(new Event("change")); } }
    }).catch(function (e) {
      msg.textContent = "The map data could not load (" + e.message + "). If you opened this file directly, serve the folder over http instead.";
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
