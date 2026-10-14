"""Drop-in condo land estimator for analysis/model.py and site/build_data.py.

Replaces "median land $/sq ft of comparable parcels in the same tax district and zoning, times lot area"
with the validated model in fit_validate.py:
  1-3 unit buildings: log(land) = cell + b*log(lot)                    fit on 1-3 family and 4-8 unit lots
  4+ unit buildings:  log(land) = cell + b1*log(lot) + b2*log(units) + b3*(log(lot) - 8.3)*log(units)
                      fit on all non-condo residential lots (incl. >8 unit apartments, multi-use residential)
  cell = tax district x zoning (district median intercept if the cell is unseen)

Usage from model.py (FY2026 property database rows as dicts, or a DataFrame via df.to_dict("records")):

    from condo_land.estimator import estimate_building_land, allocate_to_units
    bldg_land = estimate_building_land(rows)            # {GISID: land $} for every CONDO-BLDG lot
    unit_land = allocate_to_units(bldg_land, rows)      # {(GISID, Unit): land $}, by assessed value, 90% cap

Units are condo records (CONDOMINIUM, CNDO LUX, OFFICE-CONDO and other *CONDO classes except CONDO-BLDG)
sharing the building's GISID. Unit count for the curve counts residential units only (CONDOMINIUM, CNDO LUX).
"""
import math
from collections import defaultdict

import numpy as np

SMALL_FIT = {"SNGL-FAM-RES", "TWO-FAM-RES", "THREE-FM-RES", "4-8-UNIT-APT"}
LARGE_FIT = SMALL_FIT | {">8-UNIT-APT", "MULTIUSE-RES"}
RES_CONDO_UNITS = {"CONDOMINIUM", "CNDO LUX"}
CAP = 0.9  # max share of a unit's assessed value assigned to land


def _num(x):
    try:
        return float(str(x).replace('="', "").replace('"', ""))
    except (TypeError, ValueError):
        return None


def _s(x):
    return ("" if x is None else str(x)).replace('="', "").replace('"', "").strip()


def is_condo_unit(cls):
    return "CONDO" in cls and cls != "CONDO-BLDG" or cls == "CNDO LUX"


def lots(rows):
    """One record per GISID (the lot-level record), with summed unit counts."""
    recs, units, ncondo, seen = {}, defaultdict(float), defaultdict(int), set()
    for x in rows:
        g, cls = _s(x["GISID"]), _s(x["PropertyClass"])
        if cls in RES_CONDO_UNITS:
            ncondo[g] += 1
        key = _s(x.get("PID")) + "|" + _s(x.get("BldgNum"))
        if key not in seen:
            seen.add(key)
            units[g] += _num(x.get("Interior_NumUnits")) or 0
        rec = dict(cls=cls, td=_s(x["TaxDistrict"]), z=_s(x.get("Zoning")),
                   A=_num(x.get("LandArea")), L=_num(x.get("LandValue")))
        prev = recs.get(g)
        if prev is None or (not prev["A"] and rec["A"]) or (cls == "CONDO-BLDG" and prev["cls"] != "CONDO-BLDG"):
            recs[g] = rec
    for g, r in recs.items():
        r["U"] = ncondo[g] if r["cls"] == "CONDO-BLDG" else max(units[g], 1)
    return recs


def _fit(train, use_units, inter):
    cells = {}
    for r in train:
        cells.setdefault((r["td"], r["z"]), len(cells))
    k = 3 if inter else (2 if use_units else 1)
    X = np.zeros((len(train), len(cells) + k))
    y = np.empty(len(train))
    for i, r in enumerate(train):
        la, lu = math.log(r["A"]), math.log(max(r["U"], 1))
        X[i, cells[(r["td"], r["z"])]] = 1
        X[i, len(cells)] = la
        if use_units:
            X[i, len(cells) + 1] = lu
        if inter:
            X[i, len(cells) + 2] = (la - 8.3) * lu
        y[i] = math.log(r["L"])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    by_dist = defaultdict(list)
    for (td, _z), j in cells.items():
        by_dist[td].append(beta[j])
    dist = {td: float(np.median(v)) for td, v in by_dist.items()}
    coef = [float(b) for b in beta[len(cells):]]

    def predict(r):
        a = beta[cells[(r["td"], r["z"])]] if (r["td"], r["z"]) in cells else dist.get(r["td"])
        if a is None or not r["A"]:
            return float("nan")
        la, lu = math.log(r["A"]), math.log(max(r["U"], 1))
        v = a + coef[0] * la
        if use_units:
            v += coef[1] * lu
        if inter:
            v += coef[2] * (la - 8.3) * lu
        return math.exp(v)

    predict.coef = coef
    return predict


def fit_models(lot_recs):
    ok = lambda r: r["A"] and r["L"] and r["A"] > 0 and r["L"] > 0
    small = _fit([r for r in lot_recs.values() if r["cls"] in SMALL_FIT and ok(r)], use_units=False, inter=False)
    large = _fit([r for r in lot_recs.values() if r["cls"] in LARGE_FIT and ok(r)], use_units=True, inter=True)
    return small, large


def estimate_building_land(rows):
    """{GISID: estimated land $} for every CONDO-BLDG lot with a land area (NaN where no location fit)."""
    recs = lots(rows)
    small, large = fit_models(recs)
    out = {}
    for g, r in recs.items():
        if r["cls"] == "CONDO-BLDG" and r["A"]:
            out[g] = small(r) if r["U"] <= 3 else large(r)
    return out


def allocate_to_units(bldg_land, rows):
    """{(GISID, Unit): land $}: building land shared by assessed value, each unit capped at 90% of its value."""
    units = defaultdict(list)
    for x in rows:
        cls = _s(x["PropertyClass"])
        if is_condo_unit(cls):
            v = _num(x.get("AssessedValue"))
            if v and v > 0:
                units[_s(x["GISID"])].append((_s(x.get("Unit")), v))
    out = {}
    for g, us in units.items():
        land = bldg_land.get(g)
        if land is None or land != land:
            continue
        tot = sum(v for _, v in us)
        for u, v in us:
            out[(g, u)] = min(land * v / tot, CAP * v)
    return out


if __name__ == "__main__":
    import csv, json, sys
    rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig")))
    bl = estimate_building_land(rows)
    if len(sys.argv) > 2:  # compare with fit_validate.py output
        ref = json.load(open(sys.argv[2]))
        d = [abs(bl[g] / ref[g]["new"] - 1) for g in ref if g in bl and bl[g] == bl[g] and ref[g]["new"] == ref[g]["new"]]
        print(f"buildings {len(bl)}; matches fit_validate.py within 1e-9 for {sum(x < 1e-9 for x in d)}/{len(d)}")
    else:
        print(json.dumps({g: round(v) for g, v in list(bl.items())[:10]}, indent=1))
