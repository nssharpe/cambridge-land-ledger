"""Scenario engine + condo-land imputations for the four-city comparison."""
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from common import COMPARABLE_RES, GROUP_COLS, RATES

CAP = 0.90  # condo unit land capped at 90% of unit value


# ------------------------------------------------------------ comparables
def comparables(df):
    """Non-condo residential parcels with one assessor record per LOC_ID,
    usable land value and lot area. Area = GIS polygon area (LOC_ID)."""
    n_per_loc = df.groupby("LOC_ID").LOC_ID.transform("size")
    c = df[df.u3.isin(COMPARABLE_RES) & (n_per_loc == 1) & (df.land > 0)
           & (df.poly_sqft > 500) & df.cx.notna()].copy()
    c["area"] = c.poly_sqft
    c["lpsf"] = c.land / c.area
    c = c[(c.lpsf > 0)]
    # drop gross outliers in $/sqft (data errors / mismatched polygons)
    lo, hi = np.log(c.lpsf).quantile([0.005, 0.995])
    c = c[(np.log(c.lpsf) >= lo) & (np.log(c.lpsf) <= hi)]
    return c


def condo_buildings(df):
    """One row per condo building (LOC_ID with >=1 use-102 record)."""
    cd = df[df.u3 == "102"]
    b = cd.groupby("LOC_ID").agg(n_units=("total", "size"), val=("total", "sum"),
                                 poly_sqft=("poly_sqft", "first"),
                                 cx=("cx", "first"), cy=("cy", "first"),
                                 zoning=("ZONING", lambda s: s.mode().iat[0] if s.notna().any() else None))
    # master (995) record lot size, if present
    m = df[df.u3 == "995"].groupby("LOC_ID").lot_sqft.max()
    b["master_lot_sqft"] = m.reindex(b.index)
    b["area"] = b.poly_sqft
    b.loc[b.area.isna() | (b.area <= 0), "area"] = b.master_lot_sqft
    return b


# ------------------------------------------------------- land predictors
class FlatMedian:
    """Original-style: median land $/sqft of the k nearest non-condo
    residential comparables (k=25) x lot area."""
    name = "flat_knn_median"

    def __init__(self, k=25):
        self.k = k

    def fit(self, c):
        self.tree = cKDTree(c[["cx", "cy"]].values)
        self.lpsf = c.lpsf.values
        return self

    def predict(self, xy, area, exclude_self=False):
        k = self.k + (1 if exclude_self else 0)
        _, idx = self.tree.query(xy, k=k)
        if exclude_self:
            idx = idx[:, 1:]
        return np.median(self.lpsf[idx], axis=1) * area


class FlatZoning:
    """Median $/sqft within zoning district (fallback: citywide)."""
    name = "flat_zoning_median"

    def fit(self, c):
        self.by = c.groupby("ZONING").lpsf.median()
        self.all = c.lpsf.median()
        return self

    def predict_z(self, zoning, area):
        return pd.Series(zoning).map(self.by).fillna(self.all).values * area


class SizeCurve:
    """log(land/sqft) = location effect + b*log(area).

    b is estimated by within-neighbourhood regression (location fixed effects
    = k-nearest-neighbour demeaning). Location effect at a target = median of
    (log lpsf - b*log area) among the k nearest comparables."""
    name = "size_curve_knn"

    def __init__(self, k=25, b=None):
        self.k = k
        self.b_fixed = b

    def fit(self, c):
        xy = c[["cx", "cy"]].values
        self.tree = cKDTree(xy)
        y = np.log(c.lpsf.values)
        x = np.log(c.area.values)
        if self.b_fixed is None:
            _, idx = self.tree.query(xy, k=self.k + 1)
            nb = idx[:, 1:]
            yd = y - y[nb].mean(axis=1)
            xd = x - x[nb].mean(axis=1)
            self.b = float((xd * yd).sum() / (xd * xd).sum())
        else:
            self.b = self.b_fixed
        self.resid = y - self.b * x
        return self

    def predict(self, xy, area, exclude_self=False):
        k = self.k + (1 if exclude_self else 0)
        _, idx = self.tree.query(xy, k=k)
        if exclude_self:
            idx = idx[:, 1:]
        loc = np.median(self.resid[idx], axis=1)
        return np.exp(loc + self.b * np.log(area)) * area


class TypedSizeCurve:
    """Size curve with building-type terms.

    Location effect + slope b are fitted on 1-8 unit residential parcels
    (101, 104, 105, 111; kNN location effects, k=25) -- these share one
    land schedule (offsets ~0 in every city). Apartments with >8 units (112)
    get an offset and extra size slope relative to that surface, by OLS:
        log(lpsf) = loc(x) + b*log(area) + a_112 + c_112*(log(area)-m_112)
    because assessors value large-complex land on a different schedule.
    """
    name = "size_curve_typed"
    TYPES = ["112"]

    def __init__(self, k=25):
        self.k = k

    def fit(self, c):
        sf = c[c.u3 != "112"]
        self.base = SizeCurve(self.k).fit(sf)
        self.b = self.base.b
        self.coef = {}
        for t in self.TYPES:
            a = c[c.u3 == t]
            if len(a) < 10:
                self.coef[t] = (0.0, 0.0, 0.0)
                continue
            r = np.log(a.land.values / self.base.predict(a[["cx", "cy"]].values, a.area.values))
            x = np.log(a.area.values)
            m = float(x.mean())
            if t == "112" and len(a) >= 20:
                ct, at = np.polyfit(x - m, r, 1)
            else:
                ct, at = 0.0, float(np.median(r))
            self.coef[t] = (float(at), float(ct), m)
        return self

    def predict(self, xy, area, types, exclude_self=False):
        p = self.base.predict(xy, area, exclude_self=exclude_self)
        adj = np.zeros(len(area))
        types = np.asarray(types)
        for t, (at, ct, m) in self.coef.items():
            sel = types == t
            adj[sel] = at + ct * (np.log(area[sel]) - m)
        return p * np.exp(adj)


def condo_type(n_units):
    """Map a condo building to the comparable residential type."""
    n = np.asarray(n_units)
    return np.where(n <= 8, "small", "112")


# ---------------------------------------------------------- imputation
def allocate(df, bld_land):
    """Spread building land (Series indexed by LOC_ID) to condo units by
    assessed value, capped at CAP x unit value. Returns land column."""
    land = df.land.copy()
    is_c = (df.u3 == "102") & df.LOC_ID.isin(bld_land.index)
    cd = df[is_c]
    share = cd.total / cd.groupby("LOC_ID").total.transform("sum")
    est = cd.LOC_ID.map(bld_land) * share
    land.loc[is_c] = np.maximum(cd.land, np.minimum(est.fillna(0), CAP * cd.total))
    return land


def impute(df, method, k=25):
    c = comparables(df)
    b = condo_buildings(df)
    ok = b.area.notna() & (b.area > 0) & b.cx.notna()
    bl = pd.Series(np.nan, index=b.index)
    if method == "none":
        return df.land.copy(), None
    if method == "flat_zoning":
        m = FlatZoning().fit(c)
        bl[ok] = m.predict_z(b.zoning[ok].values, b.area[ok].values)
        fitted = m
    elif method == "flat_city":
        bl[ok] = c.lpsf.median() * b.area[ok]
        fitted = None
    elif method == "flat_knn":
        m = FlatMedian(k).fit(c)
        bl[ok] = m.predict(b.loc[ok, ["cx", "cy"]].values, b.area[ok].values)
        fitted = m
    elif method == "size_curve":
        m = SizeCurve(k).fit(c)
        bl[ok] = m.predict(b.loc[ok, ["cx", "cy"]].values, b.area[ok].values)
        fitted = m
    elif method == "size_curve_typed":
        m = TypedSizeCurve(k).fit(c)
        bl[ok] = m.predict(b.loc[ok, ["cx", "cy"]].values, b.area[ok].values,
                           condo_type(b.n_units[ok].values))
        fitted = m
    else:
        raise ValueError(method)
    return allocate(df, bl.dropna()), fitted


# ------------------------------------------------------------ scenario
def run(df, land, frac=0.5, pooled=False):
    """Per-parcel % change. Revenue neutral within class (R vs C) or pooled.
    Ratio new/old = (V_i/sumV_class)/(AV_i/sumAV_class)."""
    d = df[df.cls.isin(["R", "C"])].copy()
    d["land_m"] = land.loc[d.index].clip(upper=d.total)
    d["V"] = d.land_m + (1 - frac) * (d.total - d.land_m)
    key = pd.Series("ALL", index=d.index) if pooled else d.cls
    sAV = d.groupby(key).total.transform("sum")
    sV = d.groupby(key).V.transform("sum")
    rate_old = d.cls.map({"R": RATES[df.city.iat[0]][0] / 1000,
                          "C": RATES[df.city.iat[0]][1] / 1000})
    d["old_tax"] = d.total * rate_old
    if pooled:
        # pooled: same total levy, single rate on V
        levy = d.old_tax.sum()
        d["new_tax"] = d.V * levy / d.V.sum()
    else:
        d["new_tax"] = d.old_tax * (d.V / sV) / (d.total / sAV)
    d["pct"] = 100 * (d.new_tax / d.old_tax - 1)
    d["usd"] = d.new_tax - d.old_tax
    return d


def summarize(d, city, scen):
    pos = d[d.old_tax > 0]
    row = {"city": city, "scenario": scen}
    for g in GROUP_COLS:
        if g == "SF owner-proxy":
            s = pos[(pos.group == "SF all") & pos.owner_proxy]
        else:
            s = pos[pos.group == g]
        row[g] = round(float(s.pct.median()), 2) if len(s) else None
    s = pos[(pos.group == "SF all") & pos.owner_proxy]
    row["sf_oo_median_usd"] = round(float(s.usd.median()), 2)
    return row
