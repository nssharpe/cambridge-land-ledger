"""End-to-end: reproduce data/cities.json (flat condo land) and rerun with
the lot-size-aware (typed size-curve) condo land.

Outputs (next to this script):
  cities_reproduced.json  rows with the original-style imputation
  cities_new.json         rows with the new imputation (same schema)
  tables.md               comparison tables used in report.md
"""
import json
import os
import sys
import warnings

import numpy as np
import pandas as pd

from common import CITIES, GROUP_COLS, HERE, RATES, load_city
from model import comparables, condo_buildings, impute, run, summarize

warnings.filterwarnings("ignore")
PUBLISHED = (sys.argv[1] if len(sys.argv) > 1 else
             "/home/user/cambridge-land-ledger/data/cities.json")
COLS = ["city", "scenario"] + GROUP_COLS + ["sf_oo_median_usd"]
METHODS = {"repro": "flat_zoning", "new": "size_curve_typed",
           "sens_untyped": "size_curve", "sens_noland": "none"}


def md(df, floatfmt=2):
    df = df.copy()
    cols = list(df.columns)
    out = ["| " + " | ".join(map(str, cols)) + " |",
           "|" + "|".join(["---"] * len(cols)) + "|"]
    for _, r in df.iterrows():
        vals = []
        for v in r.values:
            if isinstance(v, (float, np.floating)):
                vals.append("" if np.isnan(v) else f"{v:.{floatfmt}f}")
            else:
                vals.append(str(v))
        out.append("| " + " | ".join(vals) + " |")
    return "\n".join(out)


def land_share_table(city, df, lands):
    """Aggregate condo land share (sum land / sum value), by building size,
    with assessor land shares of comparable non-condo types for reference."""
    b = condo_buildings(df)
    cd = df[df.u3 == "102"].copy()
    cd["nb"] = cd.LOC_ID.map(b.n_units)
    cd["size"] = pd.cut(cd.nb, [0, 3, 8, 1e9], labels=["1-3 units", "4-8", "9+"])
    rows = []
    for name, land in lands.items():
        r = {"city": city, "method": name,
             "all condos": land[cd.index].sum() / cd.total.sum()}
        for s, g in cd.groupby("size"):
            r[f"condo {s}"] = land[g.index].sum() / g.total.sum() if len(g) else np.nan
        rows.append(r)
    ref = {}
    for lab, codes in [("2-3F (assessor)", ["104", "105"]),
                       ("Apts 4-8 (assessor)", ["111"]),
                       ("Apts 9+ (assessor)", ["112"])]:
        g = df[df.u3.isin(codes)]
        ref[lab] = g.land.sum() / g.total.sum()
    return rows, ref


def main():
    pub = pd.DataFrame(json.load(open(PUBLISHED))["rows"])
    pub = pub[pub.city != "cambridge"].set_index(["city", "scenario"])
    out = {k: [] for k in METHODS}
    shares, refs, implied, counts = [], {}, [], []
    for city, (_, single) in CITIES.items():
        df = load_city(city)
        lands = {}
        for key, meth in METHODS.items():
            land, _ = impute(df, meth)
            lands[meth] = land
            for sc in (["A50", "C50"] if single else ["A50"]):
                d = run(df, land, pooled=(sc == "C50"))
                out[key].append(summarize(d, city, sc))
                if key == "repro":
                    s = d[(d.old_tax > 0) & (d.group == "SF all") & d.owner_proxy]
                    # rate the original must have used: median $ scales with rate
                    base = np.median(s.total * s.pct / 100)
                    pu = pub.loc[(city, sc), "sf_oo_median_usd"]
                    implied.append({"city": city, "scenario": sc,
                                    "rate used here": RATES[city][0],
                                    "implied by published $": round(pu * 1000 / base, 2)})
        cs = df[df.cls.isin(["R", "C"])]
        counts.append({"city": city, "assessor file": df.source_file.iat[0],
                       "FY": int(df.FY.mode().iat[0]),
                       "taxable records": len(cs),
                       "SF (101)": int((cs.group == "SF all").sum()),
                       "SF owner-proxy": int(((cs.group == "SF all") & cs.owner_proxy).sum()),
                       "condo units": int((cs.u3 == "102").sum()),
                       "condo buildings": int(cs[cs.u3 == "102"].LOC_ID.nunique()),
                       "comparables": len(comparables(df))})
        r, ref = land_share_table(city, df, {
            "flat zoning median (repro)": lands["flat_zoning"],
            "size curve, typed (new)": lands["size_curve_typed"],
            "size curve, untyped (sens.)": lands["size_curve"]})
        shares += r
        refs[city] = ref

    res = {k: pd.DataFrame(v)[COLS] for k, v in out.items()}
    for k in ["repro", "new"]:
        fn = {"repro": "cities_reproduced.json", "new": "cities_new.json"}[k]
        rows = json.loads(res[k].to_json(orient="records"))
        notes = {"others": ("owner-occupied = mailing-address proxy; condo land "
                            + ("imputed (flat median $/sqft by zoning x lot area)"
                               if k == "repro" else
                               "imputed with lot-size-aware land curve (kNN location effect + "
                               "log-area slope; >8-unit buildings on apartment schedule)")
                            + "; no residential exemption modelled")}
        json.dump({"columns": COLS, "rows": rows, "notes": notes},
                  open(os.path.join(HERE, fn), "w"), indent=1)

    # comparison tables
    lines = []
    lines.append("## Data used\n\n" + md(pd.DataFrame(counts), 0))
    cmp_rows = []
    for (c, s), p in pub.iterrows():
        for lab, k in [("published", None), ("reproduced", "repro"), ("new", "new")]:
            if k is None:
                r = p.to_dict()
            else:
                r = res[k].set_index(["city", "scenario"]).loc[(c, s)].to_dict()
            cmp_rows.append({"city": c, "scen": s, "version": lab,
                             **{g: r[g] for g in GROUP_COLS + ["sf_oo_median_usd"]}})
    lines.append("## Published vs reproduced vs new\n\n" + md(pd.DataFrame(cmp_rows)))
    diff = (res["repro"].set_index(["city", "scenario"])[GROUP_COLS + ["sf_oo_median_usd"]]
            - pub[GROUP_COLS + ["sf_oo_median_usd"]]).reset_index()
    lines.append("## Reproduced minus published (pct points; $ for last column)\n\n" + md(diff))
    lines.append("## Implied SF owner tax rate behind published $ column\n\n"
                 + md(pd.DataFrame(implied)))
    sens = []
    for k in ["sens_untyped", "sens_noland"]:
        t = res[k].copy()
        t.insert(2, "variant", {"sens_untyped": "untyped size curve",
                                "sens_noland": "condo land = 0"}[k])
        sens.append(t)
    lines.append("## Sensitivity\n\n" + md(pd.concat(sens)))
    sh = pd.DataFrame(shares)
    lines.append("## Aggregate condo land share (sum imputed land / sum condo value)\n\n" + md(sh, 3))
    lines.append("## Assessor land share of comparable non-condo types\n\n"
                 + md(pd.DataFrame(refs).T.reset_index().rename(columns={"index": "city"}), 3))
    open(os.path.join(HERE, "tables.md"), "w").write("\n\n".join(lines) + "\n")
    print("\n\n".join(lines))


if __name__ == "__main__":
    main()
