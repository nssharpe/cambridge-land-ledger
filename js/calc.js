/*
 * Cambridge Land Ledger: tax calculator engine.
 * Mirrors analysis/model.py run() treatment (c) and analysis/homeowner_neutral.py solve():
 *   V = land + (1 - f) * building
 *   Residential: E = (p / 0.30) * RESEX * mean(V_R) / mean(AV_R); base = max(0, V - E * eligible);
 *                rate = levy_R / sum(base)   (revenue neutral within the residential class)
 *   Commercial/industrial: rate = levy_CIP / sum(V_CIP), or unchanged FY2026 bills under residential-only coverage.
 * Usable in the browser (window.LedgerCalc) and in node (module.exports) so tests run on this exact file.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.LedgerCalc = factory(); }
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Groups shown in the calculator. Each test takes (useGroupName, classCode, eligible).
  var GROUPS = [
    { id: "oo_sf",   label: "Owner-occupied single-family", test: function (u, c, e) { return u === "single-family" && e === 1; } },
    { id: "f23",     label: "Two- and three-family",        test: function (u) { return u === "two-family" || u === "three-family"; } },
    { id: "condo",   label: "Condos",                       test: function (u) { return u === "condo"; } },
    { id: "oo_condo",label: "Owner-occupied condos",        test: function (u, c, e) { return u === "condo" && e === 1; } },
    { id: "apt48",   label: "Apartments, 4 to 8 units",     test: function (u) { return u === "4-8 apt"; } },
    { id: "apt9",    label: "Apartments, 9+ units",         test: function (u) { return u === ">8 apt"; } },
    { id: "retail",  label: "Retail stores",                test: function (u) { return u === "retail"; } },
    { id: "office",  label: "Offices",                      test: function (u) { return u === "office"; } },
    { id: "lab",     label: "Labs and R&D",                 test: function (u) { return u === "lab/R&D/high-tech"; } },
    { id: "pkvac",   label: "Parking lots and vacant land", test: function (u) { return u === "parking lot" || u === "vacant/developable land"; } },
    { id: "all_r",   label: "All residential property",     test: function (u, c) { return c === 0; }, ref: true },
    { id: "all_c",   label: "All commercial and industrial", test: function (u, c) { return c === 1; }, ref: true }
  ];

  function prepare(data) {
    var n = data.c.length, i;
    var c = Int8Array.from(data.c), e = Int8Array.from(data.e), g = Int16Array.from(data.g);
    var L = Float64Array.from(data.L), B = Float64Array.from(data.B), m = Int32Array.from(data.m);
    var P = data.params;
    var s0 = new Float64Array(n), levyR = 0, levyC = 0, sumAvR = 0, nR = 0;
    for (i = 0; i < n; i++) {
      var av = L[i] + B[i];
      if (c[i] === 0) {
        s0[i] = P.RATE_R * Math.max(0, av - P.RESEX * e[i]);
        levyR += s0[i]; sumAvR += av; nR++;
      } else {
        s0[i] = P.RATE_CIP * av;
        levyC += s0[i];
      }
    }
    var masks = GROUPS.map(function (gr) {
      var idx = [];
      for (var k = 0; k < n; k++) { if (gr.test(data.use_groups[g[k]], c[k], e[k])) idx.push(k); }
      return Int32Array.from(idx);
    });
    return { n: n, c: c, e: e, g: g, L: L, B: B, m: m, P: P, s0: s0, levyR: levyR, levyC: levyC,
             meanAvR: sumAvR / nR, nR: nR, masks: masks, useGroups: data.use_groups };
  }

  // opts: { f: 0..1, coverage: "both" | "res", p: 0.30 | 0.35 }
  function compute(D, opts) {
    var f = opts.f, p = opts.p, both = opts.coverage !== "res";
    var n = D.n, i, V = new Float64Array(n), sumVR = 0, sumVC = 0;
    for (i = 0; i < n; i++) {
      V[i] = D.L[i] + (1 - f) * D.B[i];
      if (D.c[i] === 0) sumVR += V[i]; else sumVC += V[i];
    }
    var E = (p / 0.30) * D.P.RESEX * (sumVR / D.nR) / D.meanAvR;
    var base = new Float64Array(n), sumBase = 0;
    for (i = 0; i < n; i++) {
      if (D.c[i] === 0) { base[i] = Math.max(0, V[i] - E * D.e[i]); sumBase += base[i]; }
    }
    var rR = D.levyR / sumBase, rC = D.levyC / sumVC;
    var tax = new Float64Array(n);
    for (i = 0; i < n; i++) {
      if (D.c[i] === 0) tax[i] = rR * base[i];
      else tax[i] = both ? rC * V[i] : D.s0[i];
    }
    return { tax: tax, rateR: rR, rateC: both ? rC : D.P.RATE_CIP, exemption: E,
             rateRLand: rR, rateRBldg: rR * (1 - f),
             rateCLand: both ? rC : D.P.RATE_CIP, rateCBldg: both ? rC * (1 - f) : D.P.RATE_CIP };
  }

  // numpy-style median (mean of the two middle values for even counts)
  function median(arr) {
    if (!arr.length) return NaN;
    var a = Float64Array.from(arr).sort(), h = a.length >> 1;
    return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
  }

  function summarize(D, tax) {
    return GROUPS.map(function (gr, gi) {
      var idx = D.masks[gi], pct = [], usd = new Array(idx.length), more = 0;
      for (var k = 0; k < idx.length; k++) {
        var i = idx[k], old = D.s0[i], ch = tax[i] - old;
        usd[k] = ch;
        if (old > 0) pct.push(ch / old * 100);
        if (ch > 0.5) more++;
      }
      return { id: gr.id, label: gr.label, ref: !!gr.ref, n: idx.length,
               medianPct: median(pct), medianUsd: median(usd), shareMore: idx.length ? more / idx.length : NaN };
    });
  }

  // per map feature: current and scenario totals
  function byFeature(D, tax, nFeatures) {
    var cur = new Float64Array(nFeatures), nw = new Float64Array(nFeatures);
    for (var i = 0; i < D.n; i++) {
      var m = D.m[i];
      if (m >= 0) { cur[m] += D.s0[i]; nw[m] += tax[i]; }
    }
    return { cur: cur, now: nw };
  }

  return { GROUPS: GROUPS, prepare: prepare, compute: compute, summarize: summarize, byFeature: byFeature, median: median };
}));
