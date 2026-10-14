"""Shared loading / classification for the four-city building-exemption model.

Data: MassGIS Level 3 parcels (per-town shapefile downloads), see fetch_data.sh.
"""
import glob
import os
import re

import numpy as np
import pandas as pd
import pyogrio

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")

CITIES = {
    # key: (MassGIS folder, single-rate town?)
    "worcester": ("M348_WORCESTER", False),
    "springfield": ("M281_SPRINGFIELD", False),
    "fitchburg": ("M097_FITCHBURG", True),
    "leominster": ("M153_LEOMINSTER", True),
}

# Tax rates per $1,000 for the fiscal year of the L3 assessor table.
# Sources (web search; mass.gov / DLS were unreachable from this network):
#   Worcester FY26 13.28 / 29.06 (worcesterma.gov, WBJ)
#   Springfield FY26 15.46 / 34.35 (council vote 2025-11-24, press reports)
#   Leominster FY26 single 13.66 (leominster-ma.gov Tax Rates page, via search)
#   Fitchburg: L3 table is FY2027 values (CY26); FY27 rate not set. FY26 single
#   rate ~13.29 from third-party aggregators only -- UNVERIFIED.
RATES = {
    "worcester": (13.28, 29.06),
    "springfield": (15.46, 34.35),
    "fitchburg": (13.29, 13.29),
    "leominster": (13.66, 13.66),
}

SQFT_PER_M2 = 10.7639104
SQFT_PER_ACRE = 43560.0

# ---------------------------------------------------------------- use codes
# Codes are the first three characters of USE_CODE (MA DOR classification;
# a 4th character is a local suffix).
GROUPS = {
    "SF all": {"101"},
    "2-3F": {"104", "105"},
    "Condo": {"102"},
    "Apts 4+": {f"{c}" for c in range(111, 126)},
    # 106 accessory land w/ improvement (garage/parking), 130-132 res. vacant,
    # 336 parking garage, 337 parking lot, 390-392 comm. vacant,
    # 440-442 ind. vacant
    "Vacant+parking": {"106", "130", "131", "132", "336", "337",
                       "390", "391", "392", "440", "441", "442"},
    # 320-328 retail, shopping centres, supermarkets, small retail,
    # eating & drinking (326)
    "Retail (incl. restaurant)": {f"{c}" for c in range(320, 329)},
    # 340-349 office/bank/medical, 400-439 manufacturing, warehouse,
    # utilities, mining (400-439; 440-442 vacant excluded)
    "Office+industrial": {f"{c}" for c in range(340, 350)}
    | {f"{c}" for c in range(400, 440)},
}
GROUP_COLS = ["SF owner-proxy", "SF all", "2-3F", "Condo", "Apts 4+",
              "Vacant+parking", "Retail (incl. restaurant)", "Office+industrial"]

# Non-condo residential comparables for land models
COMPARABLE_RES = {"101", "104", "105", "111", "112"}


def tax_class(u3: str) -> str:
    """R = residential, C = commercial/industrial (incl. chapter land),
    X = exempt / not modelled."""
    if not u3 or not u3[0].isdigit():
        return "X"
    d = u3[0]
    if u3 == "995":
        return "X"  # condo master record (no value)
    if d == "0":  # mixed use 0XY: X = predominant class
        return "R" if u3[1] == "1" else ("C" if u3[1] in "34" else "C")
    if d == "1":
        return "R"
    if d in "34678":
        return "C"
    return "X"  # 5xx personal property (not in L3), 9xx exempt


_ABBR = [(r"\bSTREET\b", "ST"), (r"\bAVENUE\b", "AVE"), (r"\bROAD\b", "RD"),
         (r"\bDRIVE\b", "DR"), (r"\bLANE\b", "LN"), (r"\bPLACE\b", "PL"),
         (r"\bCOURT\b", "CT"), (r"\bTERRACE\b", "TER"), (r"\bCIRCLE\b", "CIR"),
         (r"\bBOULEVARD\b", "BLVD"), (r"\bPARKWAY\b", "PKWY"), (r"\bAV\b", "AVE"),
         (r"\bTERR\b", "TER"), (r"\bSQUARE\b", "SQ"), (r"\bHIGHWAY\b", "HWY")]


def norm_addr(s):
    if not isinstance(s, str):
        return ""
    s = s.upper()
    s = re.sub(r"[.,#]", " ", s)
    s = re.sub(r"\b(UNIT|APT|STE|SUITE)\b.*$", "", s)
    for a, b in _ABBR:
        s = re.sub(a, b, s)
    return re.sub(r"\s+", " ", s).strip()


def load_city(city: str) -> pd.DataFrame:
    folder = CITIES[city][0]
    a = glob.glob(os.path.join(RAW, folder, "*", "*Assess*.dbf"))[0]
    p = glob.glob(os.path.join(RAW, folder, "*", "*TaxPar*.shp"))[0]
    df = pyogrio.read_dataframe(a, read_geometry=False)
    par = pyogrio.read_dataframe(p, columns=["LOC_ID", "POLY_TYPE"])
    par["poly_sqft"] = par.geometry.area * SQFT_PER_M2  # EPSG:26986 metres
    par["cx"] = par.geometry.centroid.x
    par["cy"] = par.geometry.centroid.y
    par = par.drop(columns="geometry")
    par = par.groupby("LOC_ID", as_index=False).agg(
        poly_sqft=("poly_sqft", "sum"), cx=("cx", "mean"), cy=("cy", "mean"))
    df = df.drop_duplicates()
    df["source_file"] = os.path.basename(a)
    df["u3"] = df.USE_CODE.astype(str).str[:3]
    df["cls"] = df.u3.map(tax_class)
    df["land"] = df.LAND_VAL.astype(float).clip(lower=0)
    df["total"] = df.TOTAL_VAL.astype(float).clip(lower=0)
    # Springfield folds OTHER_VAL into BLDG_VAL; elsewhere TOTAL = L+B+O.
    # "Building" = everything that is not land.
    df["bldg"] = (df.total - df.land).clip(lower=0)
    lot = df.LOT_SIZE.astype(float).fillna(0)
    df["lot_sqft"] = np.where(df.LOT_UNITS.astype(str).str.upper().str.startswith("S"),
                              lot, lot * SQFT_PER_ACRE)
    df = df.merge(par, on="LOC_ID", how="left")
    df["group"] = None
    for g, codes in GROUPS.items():
        df.loc[df.u3.isin(codes), "group"] = g
    # owner proxy: owner mailing address equals site address
    sa = df.SITE_ADDR.map(norm_addr)
    oa = df.OWN_ADDR.map(norm_addr)
    df["owner_proxy"] = (sa != "") & (sa == oa)
    df["city"] = city
    return df
