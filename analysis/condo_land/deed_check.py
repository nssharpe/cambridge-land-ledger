"""Compare the model's split of condo building land (by assessed value) with the master deeds'
percentage interests, for a sample of 25 Cambridge condo buildings.

Usage (from the project root, with analysis/model.py on the path):
    python publish/cambridge-land-ledger/analysis/condo_land/deed_check.py <deed_percentages.csv>

deed_percentages.csv (gisid, unit, pct_interest, ...) is transcribed from the Middlesex South Registry
and kept out of git because it lists unit numbers. This script prints aggregates only.

Within each building, both splits are normalized over the units in the deed list that the model also
has, so a condominium spread over several parcels, or with deed units outside the model's list, is
compared on the same set of units. The building land
pool is the model's uncapped land for those units; each split applies the same 90% cap. Bills use the
50% building exemption with both classes and the recalculated 30% residential exemption (S1c), with
rates held at the model's values (re-splitting land within 25 buildings moves class rates negligibly).
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "analysis"))
import model as M  # noqa: E402


def size_class(n):
    return "2-3" if n <= 3 else ("4-8" if n <= 8 else "9+")


def main(path):
    deed = pd.read_csv(path, dtype={"gisid": str, "unit": str})
    deed["pct"] = deed["pct_interest"].astype(float)
    d0, _ = M.load()
    d, t, info = M.run(d0, 1.0)
    u = info["diag"]["units"]
    rR, rC = info["rates"]["S1c"]
    ec = info["resex_c"]["S1"]

    def bill(L, B, r):
        v = L + 0.5 * B
        return np.where(r.cls2 == "R", rR * np.maximum(0.0, v - ec * r.resex_elig), rC * v)

    rows, bldg = [], []
    for g, dg in deed.groupby("gisid"):
        r = d[(d.gisid == g) & d.index.isin(u.index)].copy()
        r["unit"] = r["Unit"].astype(str).str.strip()
        r = r[r["unit"].isin(dg.unit)]
        r["pct"] = r["unit"].map(dict(zip(dg.unit, dg.pct)))
        n = len(r)
        pool = float(u.loc[r.index, "land_uncapped"].sum())
        vs = r.av / r.av.sum()
        ps = r.pct / r.pct.sum()
        L_v = np.minimum(pool * vs, 0.9 * r.av)
        L_p = np.minimum(pool * ps, 0.9 * r.av)
        tx = r.taxable.to_numpy()
        b_v = bill(L_v, r.av - L_v, r)[tx]
        b_p = bill(L_p, r.av - L_p, r)[tx]
        chk = float(np.max(np.abs(b_v - t.loc[r.index[tx], "tax_S1c"].to_numpy())))
        with np.errstate(divide="ignore", invalid="ignore"):
            ch = np.where(b_v > 0, (b_p - b_v) / b_v * 100, np.nan)
        dpp = (ps - vs).to_numpy()[tx]
        rel = float(np.mean(np.abs(ps / vs - 1))) * 100
        # elasticity of deed share with respect to value share (1 = proportional, <1 = flatter than value)
        el = (float(np.polyfit(np.log(vs), np.log(ps), 1)[0])
              if vs.round(6).nunique() > 1 and ps.round(4).nunique() > 1 else np.nan)   # skip equal-percentage deeds
        cap_units = int((pool * ps > 0.9 * r.av).sum())
        bldg.append({"size": size_class(n), "n": n, "mad_pp": float(np.mean(np.abs(ps - vs))) * 100,
                     "rel_gap_pct": rel, "elasticity": el,
                     "max_pp": float(np.max(np.abs(ps - vs))) * 100, "check_$": chk,
                     "equal_pct": bool(ps.round(4).nunique() == 1), "exempt_units": int((~tx).sum()),
                     "cap_units": cap_units, "land_change": float(L_p.sum() - L_v.sum())})
        for c, dv, dp in zip(ch, b_p - b_v, dpp):
            rows.append({"size": size_class(n), "pct_change": c, "usd_change": dv, "share_diff_pp": dp * 100})
    B = pd.DataFrame(bldg)
    U = pd.DataFrame(rows)
    print(f"buildings {len(B)}, units {len(U)}; max |model bill - S1c| ${B['check_$'].max():.4f}")
    print(f"buildings with equal deed percentages: {int(B.equal_pct.sum())}; tax-exempt units in pool: {int(B.exempt_units.sum())}")
    print(f"90% cap binds under the deed split for {int(B.cap_units.sum())} units in {int((B.cap_units > 0).sum())} buildings; "
          f"building land changes by ${B.land_change.sum():,.0f} in total")
    print(f"bill changes: {int(U["pct_change"].isna().sum())} units with a $0 value-split bill left out of % stats")
    out = []
    for s, gB in list(B.groupby("size")) + [("all", B)]:
        gU = U if s == "all" else U[U["size"] == s]
        a = gU["pct_change"].abs()
        out.append({"size": s, "buildings": len(gB), "units": len(gU),
                    "mean MAD share (pp)": gB.mad_pp.mean(), "median MAD share (pp)": gB.mad_pp.median(),
                    "max unit share gap (pp)": gB.max_pp.max(),
                    "mean relative share gap %": gB.rel_gap_pct.mean(),
                    "median elasticity": gB.elasticity.median(),
                    "median |bill change| %": a.median(), "p90 |bill change| %": a.quantile(0.9),
                    "max |bill change| %": a.max(), "units >5% change": float((a > 5).mean()), "units >10% change": float((a > 10).mean()),
                    "median |bill change| $": gU.usd_change.abs().median()})
    print(pd.DataFrame(out).round(2).T.to_string(header=False))


if __name__ == "__main__":
    main(sys.argv[1])
