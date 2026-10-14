"""Condo land estimate v3: assessor land as a function of location, lot size and unit count.
Fit on non-condo residential lots (1-3 family, 4-8 and >8 unit apartments, multi-use residential);
validated by 5-fold CV (by class and lot size) and on lots that were converted to condos (FY2015-FY2025).
Usage: python3 condo_land_v3.py <gis_repo> <out_dir>
"""
import csv, json, math, random, statistics as st, sys
from collections import defaultdict
import numpy as np
repo, out = sys.argv[1:3]
FIT = {"SNGL-FAM-RES", "TWO-FAM-RES", "THREE-FM-RES", "4-8-UNIT-APT", ">8-UNIT-APT", "MULTIUSE-RES"}
OLDRES = {"SNGL-FAM-RES", "TWO-FAM-RES", "THREE-FM-RES", "4-8-UNIT-APT"}
CONDO_UNITS = {"CONDOMINIUM", "CNDO LUX"}
num = lambda x: float(x) if x not in ("", "NULL", None) else None
clean = lambda s: (s or "").replace('="', "").replace('"', "").strip()

def load(fy):
    p = f"{repo}/Assessing/FY{fy}/FY{fy}_Parcels/ASSESSING_PropertyDatabase_FY{fy}.csv"
    recs, units, ncondo, seenpid = {}, defaultdict(float), defaultdict(int), set()
    for x in csv.DictReader(open(p, encoding="utf-8-sig", errors="replace")):
        g = clean(x["GISID"]); cls = clean(x["PropertyClass"])
        if cls in CONDO_UNITS: ncondo[g] += 1
        pid = clean(x["PID"]) + "|" + clean(x.get("BldgNum", ""))
        if pid not in seenpid:
            seenpid.add(pid); units[g] += num(clean(x.get("Interior_NumUnits"))) or 0
        rec = dict(cls=cls, td=clean(x["TaxDistrict"]), z=clean(x.get("Zoning")),
                   A=num(clean(x["LandArea"])), L=num(clean(x["LandValue"])), B=num(clean(x["BuildingValue"])))
        prev = recs.get(g)
        if prev is None or (not prev["A"] and rec["A"]) or (rec["cls"] == "CONDO-BLDG" and prev["cls"] != "CONDO-BLDG"):
            recs[g] = rec
    for g, r in recs.items():
        r["U"] = ncondo[g] if r["cls"] == "CONDO-BLDG" else max(units[g], 1)
    return recs

r26 = load(2026)
comps = [r for r in r26.values() if r["cls"] in FIT and r["A"] and r["L"] and r["A"] > 0 and r["L"] > 0]
print("fit lots:", len(comps))

def design(rows, cells, inter):
    X = np.zeros((len(rows), len(cells) + (3 if inter else 2)))
    for i, r in enumerate(rows):
        X[i, cells[(r["td"], r["z"])]] = 1
        la, lu = math.log(r["A"]), math.log(max(r["U"], 1))
        X[i, -2 if not inter else -3] = la; X[i, -1 if not inter else -2] = lu
        if inter: X[i, -1] = (la - 8.3) * lu
    return X

def fit_reg(train, inter=False, use_units=True):
    cells = {}
    for r in train: cells.setdefault((r["td"], r["z"]), len(cells))
    tr = train if use_units else [dict(r, U=1) for r in train]
    X = design(tr, cells, inter); y = np.array([math.log(r["L"]) for r in tr])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    # district fallback intercept for unseen cells
    dist = defaultdict(list)
    for (td, z), j in cells.items(): dist[td].append(beta[j])
    dfb = {k: float(np.median(v)) for k, v in dist.items()}
    k = 3 if inter else 2
    def pred(r):
        key = (r["td"], r["z"])
        a = beta[cells[key]] if key in cells else dfb.get(r["td"])
        if a is None: return float("nan")
        la, lu = math.log(r["A"]), math.log(max(r["U"], 1) if use_units else 1)
        v = a + beta[-k] * la + beta[-k + 1] * lu + (beta[-1] * (la - 8.3) * lu if inter else 0)
        return math.exp(v)
    pred.coef = [float(b) for b in beta[-k:]]
    return pred

def fit_flat(train):
    c = defaultdict(list)
    for r in train:
        if r["cls"] in OLDRES: c[(r["td"], r["z"])].append(r["L"] / r["A"])
    m = {k: st.median(v) for k, v in c.items()}
    return lambda r: r["A"] * m.get((r["td"], r["z"]), float("nan"))

SPECS = {
    "published: flat median $/sf": fit_flat,
    "lot size only": lambda t: fit_reg([r for r in t if r["cls"] in OLDRES], use_units=False),
    "lot size + units": lambda t: fit_reg(t),
    "lot size x units": lambda t: fit_reg(t, inter=True),
}
def stats(e):
    e = [x for x in e if x == x]
    if not e: return None
    a = sorted(abs(x) for x in e)
    return dict(n=len(e), bias=round(math.exp(st.median(e)), 3), med_abs=round(st.median(a), 3), p90_abs=round(a[int(0.9 * (len(a) - 1))], 3))
BINS = [("1-3 family", lambda r: r["cls"] in {"SNGL-FAM-RES", "TWO-FAM-RES", "THREE-FM-RES"}),
        ("4-8 apt", lambda r: r["cls"] == "4-8-UNIT-APT"),
        (">8 apt, lot <10k", lambda r: r["cls"] == ">8-UNIT-APT" and r["A"] < 10000),
        (">8 apt, lot 10-25k", lambda r: r["cls"] == ">8-UNIT-APT" and 10000 <= r["A"] < 25000),
        (">8 apt, lot >=25k", lambda r: r["cls"] == ">8-UNIT-APT" and r["A"] >= 25000),
        ("multi-use res", lambda r: r["cls"] == "MULTIUSE-RES")]
random.seed(1); order = list(range(len(comps))); random.shuffle(order)
cv = {}
for name, fitter in SPECS.items():
    errs = [None] * len(comps)
    for k in range(5):
        test = set(order[k::5]); p = fitter([comps[i] for i in range(len(comps)) if i not in test])
        for i in test: errs[i] = math.log(p(comps[i]) / comps[i]["L"])
    cv[name] = {b: stats([errs[i] for i in range(len(comps)) if f(comps[i])]) for b, f in BINS}
    cv[name]["all"] = stats(errs)
# conversions: lot non-condo residential in an earlier year, condo building in FY2026
cb26 = {g: r for g, r in r26.items() if r["cls"] == "CONDO-BLDG" and r["A"] and r["U"] > 0}
truth = {}
for fy in range(2025, 2014, -1):
    old = load(fy); rat = defaultdict(list)
    for g, o in old.items():
        n = r26.get(g)
        if n and o["cls"] in FIT and n["cls"] in FIT and o["L"] and n["L"] and o["A"] and n["A"] and abs(o["A"] - n["A"]) <= 0.01 * n["A"]:
            rat[n["td"]].append(n["L"] / o["L"])
    grow = {k: st.median(v) for k, v in rat.items() if len(v) >= 10}
    for g, n in cb26.items():
        o = old.get(g)
        if g not in truth and o and o["cls"] in FIT and o["L"] and o["A"] and abs(o["A"] - n["A"]) <= 0.01 * n["A"] and n["td"] in grow:
            truth[g] = (fy, o["L"] * grow[n["td"]], o["cls"])
full = {name: fitter(comps) for name, fitter in SPECS.items()}
conv = {}
for name, p in full.items():
    e = {g: math.log(p(cb26[g]) / L) for g, (fy, L, c) in truth.items()}
    conv[name] = dict(all=stats(list(e.values())),
                      units_2_3=stats([v for g, v in e.items() if cb26[g]["U"] <= 3]),
                      units_4_plus=stats([v for g, v in e.items() if cb26[g]["U"] >= 4]),
                      lot_ge_5000=stats([v for g, v in e.items() if cb26[g]["A"] >= 5000]))
for name in SPECS:
    print(f"\n== {name}  coef(logA, logU[, inter])={getattr(full[name], 'coef', '')}")
    for b, s in cv[name].items(): print(f"   CV {b:20s} {s}")
    for b, s in conv[name].items(): print(f"   CONV {b:12s} {s}")
# Hybrid: buildings of 1-3 units look like the 1-3 family lots the size-only curve is fit on (validated
# on 332 conversions); 4+ unit buildings use the lot size x units model (validated on >8 unit apartments).
def chosen(r): return full["lot size only"](r) if r["U"] <= 3 else full["lot size x units"](r)
best = "hybrid: lot size only (1-3 units), lot size x units (4+ units)"
print("\nchosen:", best)
pred = {g: dict(td=r["td"], z=r["z"], A=r["A"], U=r["U"], new=chosen(r), old=full["published: flat median $/sf"](r),
                sizeonly=full["lot size only"](r)) for g, r in cb26.items()}
eh = {g: math.log(chosen(cb26[g]) / L) for g, (fy, L, c) in truth.items()}
conv[best] = dict(all=stats(list(eh.values())), units_2_3=stats([v for g, v in eh.items() if cb26[g]["U"] <= 3]),
                  units_4_plus=stats([v for g, v in eh.items() if cb26[g]["U"] >= 4]))
print("hybrid conversions:", conv[best])
e = sorted(eh.values())
band = dict(p10=math.exp(e[int(0.1 * len(e))]), p50=math.exp(e[len(e) // 2]), p90=math.exp(e[int(0.9 * len(e))]))
print("conversion band:", {k: round(v, 3) for k, v in band.items()}, "n", len(e), "units in truth set max", max(cb26[g]["U"] for g in truth))
json.dump(pred, open(f"{out}/condo_land_pred.json", "w"))
json.dump(dict(cv=cv, conv=conv, chosen=best, band=band, n_truth=len(truth), coef={k: getattr(v, "coef", None) for k, v in full.items()}), open(f"{out}/validation.json", "w"), indent=1)
for lo, hi in [(0, 5000), (5000, 10000), (10000, 25000), (25000, 1e9)]:
    sel = [p for p in pred.values() if lo <= p["A"] < hi and p["new"] == p["new"] and p["old"] == p["old"]]
    print(f"condo lots {lo}-{hi:.0f}: n={len(sel)} new ${sum(p['new'] for p in sel)/1e9:.2f}B old ${sum(p['old'] for p in sel)/1e9:.2f}B size-only ${sum(p['sizeonly'] for p in sel)/1e9:.2f}B")
