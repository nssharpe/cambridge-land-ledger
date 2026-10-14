"""k-fold holdout: flat-median vs size-curve land predictors on non-condo
residential parcels (assessor land value is the target).

Writes validation.csv and prints summary tables."""
import os
import warnings

import numpy as np
import pandas as pd

from common import CITIES, HERE, load_city
from model import FlatMedian, FlatZoning, SizeCurve, TypedSizeCurve, comparables

warnings.filterwarnings("ignore")
K_FOLDS = 5
BINS = [0, 5000, 10000, 20000, 43560, 4 * 43560, np.inf]
BIN_LABELS = ["<5k", "5-10k", "10-20k", "20k-1ac", "1-4ac", ">4ac"]


def cv_city(df, seed=0):
    c = comparables(df).reset_index(drop=True)
    rng = np.random.default_rng(seed)
    fold = rng.integers(0, K_FOLDS, len(c))
    preds = {m: np.full(len(c), np.nan) for m in
             ["flat_zoning", "flat_knn", "size_curve", "size_curve_typed"]}
    bs = []
    for f in range(K_FOLDS):
        tr, te = c[fold != f], c[fold == f]
        xy, ar = te[["cx", "cy"]].values, te.area.values
        preds["flat_zoning"][te.index] = FlatZoning().fit(tr).predict_z(te.ZONING.values, ar)
        preds["flat_knn"][te.index] = FlatMedian(25).fit(tr).predict(xy, ar)
        sc = SizeCurve(25).fit(tr)
        bs.append(sc.b)
        preds["size_curve"][te.index] = sc.predict(xy, ar)
        preds["size_curve_typed"][te.index] = TypedSizeCurve(25).fit(tr).predict(xy, ar, te.u3.values)
    out = c[["LOC_ID", "u3", "area", "land"]].copy()
    for m, p in preds.items():
        out["err_" + m] = np.log(p / c.land.values)
    out["bin"] = pd.cut(out.area, BINS, labels=BIN_LABELS)
    return out, bs


def main():
    rows, allerr = [], []
    for city in CITIES:
        df = load_city(city)
        e, bs = cv_city(df)
        e["city"] = city
        allerr.append(e)
        full = SizeCurve(25).fit(comparables(df))
        r = {"city": city, "n": len(e), "b_full": round(full.b, 3),
             "b_folds": f"{min(bs):.3f}..{max(bs):.3f}"}
        ft = TypedSizeCurve(25).fit(comparables(df))
        r["b_sf_typed"] = round(ft.b, 3)
        r["a112"], r["c112"] = round(ft.coef["112"][0], 3), round(ft.coef["112"][1], 3)
        for m in ["flat_zoning", "flat_knn", "size_curve", "size_curve_typed"]:
            r["MdAE_" + m] = round(float(e["err_" + m].abs().median()), 4)
            r["bias_" + m] = round(float(e["err_" + m].median()), 4)
        rows.append(r)
    summ = pd.DataFrame(rows)
    allerr = pd.concat(allerr)
    allerr.to_csv(os.path.join(HERE, "validation_errors.csv.gz"), index=False)
    summ.to_csv(os.path.join(HERE, "validation.csv"), index=False)
    pd.set_option("display.width", 250)
    print(summ.to_string(index=False))
    for stat, fn in [("median |log err|", lambda s: s.abs().median()),
                     ("median signed log err (pred/actual)", lambda s: s.median())]:
        print("\nBy lot-size bin:", stat)
        t = allerr.groupby(["city", "bin"]).agg(
            n=("area", "size"),
            flat_zoning=("err_flat_zoning", fn),
            flat_knn=("err_flat_knn", fn),
            size_curve=("err_size_curve", fn),
            size_curve_typed=("err_size_curve_typed", fn))
        print(t.round(3).to_string())
    print("\nBy use code (median |log err|):")
    allerr["ug"] = allerr.u3.map({"101": "SF", "104": "2-3F", "105": "2-3F",
                                  "111": "Apts4-8", "112": "Apts9+"})
    t = allerr.groupby(["city", "ug"]).agg(
        n=("area", "size"),
        flat_zoning=("err_flat_zoning", lambda s: s.abs().median()),
        flat_knn=("err_flat_knn", lambda s: s.abs().median()),
        size_curve=("err_size_curve", lambda s: s.abs().median()),
        size_curve_typed=("err_size_curve_typed", lambda s: s.abs().median()))
    print(t.round(3).to_string())


if __name__ == "__main__":
    main()
