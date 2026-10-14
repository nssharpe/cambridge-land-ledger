# Four-city 50% building exemption: re-implementation and lot-size-aware condo land

Run from scratch: `./run.sh` (it downloads the data, then runs `validate_land.py` and `run_all.py`). Code: `common.py` handles loading, use codes and the owner proxy. `model.py` holds the scenario engine and the land models.

## Data
- MassGIS L3 per-town shapefiles from `s3.us-east-1.amazonaws.com/download.massgis.digital.mass.gov/shapefiles/l3parcels/L3_SHP_M{id}_{TOWN}.zip`. Each file has an assessor table (`*Assess*.dbf`) and parcel polygons (`*TaxPar*.shp`, EPSG:26986). The two are joined on `LOC_ID`.
- Vintages that are currently on S3: Worcester FY2026, Springfield FY2026, **Fitchburg FY2027** (CY26 values) and Leominster FY2026. The original run may have used an older Fitchburg file. Older snapshots exist under `parcel_backup/` and the `L3_AGGREGATE_*` zips (6–8 GB each), but I did not use them.
- L3 has **no personal property** records (no 5xx codes), so personal property is excluded, which is the same as holding it fixed. It also has **no assessor neighborhood field**.

## Model (A50 / C50)
- Building = TOTAL_VAL − LAND_VAL. This includes OTHER_VAL (yard items). Springfield already folds OTHER into BLDG_VAL; the other towns have TOTAL = L+B+O. Under A50, taxable V = land + 0.5·building.
- Classes are R = 1xx plus mixed-use 01x. C = 3xx, 4xx, mixed 03x/04x and chapter land 6xx–8xx. 9xx (exempt), 995 (condo master records, $0) and anything else are excluded.
- A50 is revenue neutral within each class: new/old = (V_i/ΣV_class)/(AV_i/ΣAV_class). C50 pools R and C into one class, which is only valid for single-rate towns.
- Results are medians of per-parcel % change among parcels with old tax > 0. The $ column is the median of (new − old) for SF owner-proxy parcels, at the actual FY residential rate.
- Owner proxy: the normalized SITE_ADDR equals the normalized OWN_ADDR (case, punctuation and street-suffix abbreviations normalized; unit text dropped). This flags 85% / 79% / 90% / 94% of SF parcels in Worcester / Springfield / Fitchburg / Leominster.
- No residential exemption is modelled.

### Use-code lists (first 3 characters of USE_CODE)
| Group | Codes |
|---|---|
| SF all | 101 |
| SF owner-proxy | 101 and owner-proxy match |
| 2-3F | 104, 105 |
| Condo | 102 |
| Apts 4+ | 111–125 |
| Vacant+parking | 106, 130, 131, 132, 336, 337, 390, 391, 392, 440, 441, 442 |
| Retail (incl. restaurant) | 320–328 |
| Office+industrial | 340–349, 400–439 |
| Land-model comparables | 101, 104, 105, 111, 112 (only LOC_IDs with a single record, land > 0, polygon > 500 sq ft, 0.5%/99.5% log $/sqft trimmed) |

### Tax rates (per $1,000)
mass.gov and DLS are blocked from this network, so the rates come from web search:
- Worcester FY26: 13.28 R / 29.06 CIP (worcesterma.gov, Worcester Business Journal).
- Springfield FY26: 15.46 / 34.35 (council vote of 2025-11-24, press and meeting-summary sources).
- Leominster FY26: single rate 13.66 (the city's Tax Rates page as shown in search snippets). This also confirms Leominster is a single-rate town.
- Fitchburg: the data is FY27 and the FY27 rate is not set yet. I used 13.29, an FY26 figure from third-party aggregators only (**unverified**). Fitchburg's single-rate status comes from a 2019 WBJ report that the council voted to move to a single rate, plus an aggregator listing equal class rates. I could not check it against DLS.

The "implied rate" table below backs out the rate the original must have used from its published $ column. It gives about 13.5 for Worcester, 12.2–12.9 for Fitchburg and 13.3–13.6 for Leominster, which fits these rates. Springfield's $ median is about 0, so its implied rate is meaningless.

## Condo land
- **Lot area of a condo building** = the area of the TaxPar polygon(s) for the units' shared LOC_ID. Where a 995 master record exists (Worcester 306 of 315 buildings, Leominster 47 of 72), its LOT_SIZE matches the polygon area within about 1% (median |log ratio| 0.011–0.013), so the two sources agree. 15 condo units with no LOC_ID get no land.
- **Reproduction ("flat")**: building land = median land $/sqft of comparables in the same ZONING district (citywide median as fallback) × lot area. It is allocated to units by assessed value and capped at 90% of each unit's value. Of the variants I tried (citywide median, kNN median, zoning median), this one matches the published residential columns best (see the reproduction table).
- **New ("size curve, typed")**: log(land/sqft) = location effect + b·log(area).
  - The location effect is the median of (log lpsf − b·log area) over the 25 nearest comparables (parcel centroids). L3 has no neighborhood code, so kNN stands in for it.
  - b is estimated within neighborhoods: the kNN-demeaned OLS slope on 1–8-unit residential parcels (101/104/105/111). Holdout shows these types share one schedule.
  - Parcels with more than 8 units (112) are valued by assessors on a very different schedule. Against the house-lot curve their land comes out about e^1.3 to e^2.0 higher (Leominster about e^0.44) and rises more steeply with area. So 112 gets its own offset a and extra slope c, estimated by OLS against the house-lot surface.
  - Condo buildings with 1–8 units use the house-lot curve. Buildings with 9 or more units use the 112 schedule.
  - Allocation and the 90% cap are the same as in the flat method.
- b per city (1–8-unit curve): Worcester −0.78, Springfield −0.89, Fitchburg −0.91, Leominster −0.87. All curve with 112 rows pooled in: −0.69, −0.84, −0.87, −0.82. These are steeper than Cambridge's −0.62, meaning land value is closer to a flat per-lot site value. 112 terms (a, c): Worcester 1.98, 0.50; Springfield 1.74, 0.63; Fitchburg 1.32, 0.60; Leominster 0.44, 0.50.

### Holdout validation (5-fold random CV on non-condo comparables; median |log(pred/actual land)|)
| city | n | flat zoning median (original) | flat kNN median | size curve (untyped) | size curve (typed, new) |
|---|---|---|---|---|---|
| Worcester | 35,365 | 0.225 | 0.144 | 0.044 | 0.040 |
| Springfield | 34,443 | 0.231 | 0.116 | 0.009 | 0.005 |
| Fitchburg | 9,138 | 0.351 | 0.284 | 0.033 | 0.021 |
| Leominster | 9,701 | 0.252 | 0.200 | 0.014 | 0.011 |

Large lots and 9+ unit apartments matter most, because most condo units sit in large complexes:

| city | 9+ unit apts (112) n | flat zoning: bias / MdAE | untyped curve: bias / MdAE | typed curve: bias / MdAE |
|---|---|---|---|---|
| Worcester | 133 | −0.69 / 0.78 | −1.79 / 1.79 | −0.17 / 0.39 |
| Springfield | 44 | −0.26 / 0.31 | −1.67 / 1.67 | −0.08 / 0.26 |
| Fitchburg | 36 | +0.19 / 0.41 | −0.80 / 0.80 | −0.04 / 0.31 |
| Leominster | 66 | +1.50 / 1.50 | −0.15 / 0.38 | +0.13 / 0.43 |

The flat $/sqft method over-predicts lots above 20k sq ft by e^0.4 to e^1.5. The untyped size curve under-predicts large apartment complexes by e^1.7 to e^1.8 in Worcester and Springfield. The typed curve is the only method that is roughly unbiased across sizes. Full tables by lot-size bin and use type are in `validation_output.txt`.

## Data used

| city | assessor file | FY | taxable records | SF (101) | SF owner-proxy | condo units | condo buildings | comparables |
|---|---|---|---|---|---|---|---|---|
| worcester | M348Assess_CY26_FY26.dbf | 2026 | 45755 | 25792 | 21911 | 5001 | 315 | 35365 |
| springfield | M281Assess_CY26_FY26.dbf | 2026 | 42035 | 26550 | 20937 | 1870 | 41 | 34443 |
| fitchburg | M097Assess_CY26_FY27.dbf | 2027 | 12437 | 6657 | 5965 | 1022 | 61 | 9138 |
| leominster | M153Assess_CY25_FY26.dbf | 2026 | 13773 | 8316 | 7828 | 1933 | 72 | 9701 |

## Published vs reproduced vs new

| city | scen | version | SF owner-proxy | SF all | 2-3F | Condo | Apts 4+ | Vacant+parking | Retail (incl. restaurant) | Office+industrial | sf_oo_median_usd |
|---|---|---|---|---|---|---|---|---|---|---|---|
| worcester | A50 | published | 3.30 | 3.32 | -6.01 | -7.63 | -9.71 | 60.23 | 8.47 | -0.08 | 171.79 |
| worcester | A50 | reproduced | 3.24 | 3.24 | -6.09 | -7.38 | -9.53 | 60.10 | 9.16 | -7.96 | 169.13 |
| worcester | A50 | new | 3.30 | 3.30 | -6.03 | -3.18 | -9.48 | 60.19 | 9.16 | -7.96 | 172.21 |
| springfield | A50 | published | 0.02 | 0.11 | -0.37 | -7.36 | -3.42 | 71.89 | -1.13 | -5.65 | 0.89 |
| springfield | A50 | reproduced | -0.03 | 0.02 | -0.46 | -7.25 | -3.51 | 71.74 | -0.79 | -8.25 | -1.23 |
| springfield | A50 | new | -0.00 | 0.05 | -0.43 | -7.56 | -3.48 | 71.79 | -0.79 | -8.25 | -0.12 |
| fitchburg | A50 | published | 2.33 | 2.36 | -2.97 | -6.94 | -6.80 | 61.74 | 4.00 | 6.25 | 116.38 |
| fitchburg | A50 | reproduced | 2.42 | 2.39 | -2.93 | -7.29 | -6.76 | 61.79 | 4.82 | 2.95 | 120.15 |
| fitchburg | A50 | new | 2.44 | 2.41 | -2.91 | -9.03 | -6.74 | 61.83 | 4.82 | 2.95 | 121.15 |
| fitchburg | C50 | published | 1.95 | 1.98 | -3.32 | -7.28 | -7.14 | 61.15 | 6.48 | 8.78 | 97.88 |
| fitchburg | C50 | reproduced | 2.15 | 2.12 | -3.19 | -7.54 | -7.00 | 61.36 | 6.62 | 4.72 | 106.80 |
| fitchburg | C50 | new | 2.16 | 2.14 | -3.17 | -9.27 | -6.99 | 61.39 | 6.64 | 4.74 | 107.69 |
| leominster | A50 | published | 2.58 | 2.65 | -2.13 | -7.12 | -6.72 | 57.16 | 10.71 | -2.11 | 157.40 |
| leominster | A50 | reproduced | 2.59 | 2.66 | -2.13 | -7.24 | -6.70 | 57.17 | 8.29 | -3.64 | 158.40 |
| leominster | A50 | new | 4.04 | 4.10 | -0.75 | -17.49 | -5.39 | 59.38 | 8.29 | -3.64 | 245.98 |
| leominster | C50 | published | 2.11 | 2.18 | -2.59 | -7.55 | -7.15 | 56.43 | 13.83 | 0.65 | 128.65 |
| leominster | C50 | reproduced | 2.16 | 2.22 | -2.54 | -7.63 | -7.10 | 56.50 | 11.09 | -1.14 | 132.05 |
| leominster | C50 | new | 3.38 | 3.45 | -1.38 | -18.01 | -5.99 | 58.37 | 12.42 | 0.04 | 206.53 |

## Reproduced minus published (pct points; $ for last column)

| city | scenario | SF owner-proxy | SF all | 2-3F | Condo | Apts 4+ | Vacant+parking | Retail (incl. restaurant) | Office+industrial | sf_oo_median_usd |
|---|---|---|---|---|---|---|---|---|---|---|
| worcester | A50 | -0.06 | -0.08 | -0.08 | 0.25 | 0.18 | -0.13 | 0.69 | -7.88 | -2.66 |
| springfield | A50 | -0.05 | -0.09 | -0.09 | 0.11 | -0.09 | -0.15 | 0.34 | -2.60 | -2.12 |
| fitchburg | A50 | 0.09 | 0.03 | 0.04 | -0.35 | 0.04 | 0.05 | 0.82 | -3.30 | 3.77 |
| fitchburg | C50 | 0.20 | 0.14 | 0.13 | -0.26 | 0.14 | 0.21 | 0.14 | -4.06 | 8.92 |
| leominster | A50 | 0.01 | 0.01 | 0.00 | -0.12 | 0.02 | 0.01 | -2.42 | -1.53 | 1.00 |
| leominster | C50 | 0.05 | 0.04 | 0.05 | -0.08 | 0.05 | 0.07 | -2.74 | -1.79 | 3.40 |

## Implied SF owner tax rate behind published $ column

| city | scenario | rate used here | implied by published $ |
|---|---|---|---|
| worcester | A50 | 13.28 | 13.49 |
| springfield | A50 | 15.46 | -11.18 |
| fitchburg | A50 | 13.29 | 12.87 |
| fitchburg | C50 | 13.29 | 12.18 |
| leominster | A50 | 13.66 | 13.57 |
| leominster | C50 | 13.66 | 13.31 |

## Sensitivity

| city | scenario | variant | SF owner-proxy | SF all | 2-3F | Condo | Apts 4+ | Vacant+parking | Retail (incl. restaurant) | Office+industrial | sf_oo_median_usd |
|---|---|---|---|---|---|---|---|---|---|---|---|
| worcester | A50 | untyped size curve | 4.40 | 4.39 | -5.04 | -17.48 | -8.52 | 61.89 | 9.16 | -7.96 | 229.89 |
| springfield | A50 | untyped size curve | 0.20 | 0.25 | -0.23 | -13.70 | -3.29 | 72.14 | -0.79 | -8.25 | 8.29 |
| fitchburg | A50 | untyped size curve | 3.13 | 3.10 | -2.26 | -17.79 | -6.11 | 62.91 | 4.82 | 2.95 | 156.59 |
| fitchburg | C50 | untyped size curve | 2.76 | 2.73 | -2.61 | -18.08 | -6.45 | 62.33 | 7.26 | 5.35 | 137.52 |
| leominster | A50 | untyped size curve | 4.23 | 4.29 | -0.57 | -19.38 | -5.22 | 59.67 | 8.29 | -3.64 | 257.41 |
| leominster | C50 | untyped size curve | 3.54 | 3.61 | -1.22 | -19.90 | -5.84 | 58.62 | 12.60 | 0.20 | 216.08 |
| worcester | A50 | condo land = 0 | 4.59 | 4.58 | -4.86 | -18.91 | -8.35 | 62.18 | 9.16 | -7.96 | 240.18 |
| springfield | A50 | condo land = 0 | 0.22 | 0.27 | -0.21 | -13.92 | -3.27 | 72.17 | -0.79 | -8.25 | 9.00 |
| fitchburg | A50 | condo land = 0 | 3.26 | 3.23 | -2.14 | -18.44 | -5.99 | 63.12 | 4.82 | 2.95 | 162.85 |
| fitchburg | C50 | condo land = 0 | 2.87 | 2.84 | -2.51 | -18.75 | -6.35 | 62.51 | 7.38 | 5.46 | 143.37 |
| leominster | A50 | condo land = 0 | 4.40 | 4.47 | -0.40 | -20.03 | -5.06 | 59.94 | 8.29 | -3.64 | 267.93 |
| leominster | C50 | condo land = 0 | 3.69 | 3.76 | -1.08 | -20.57 | -5.71 | 58.85 | 12.76 | 0.34 | 225.48 |

## Aggregate condo land share (sum imputed land / sum condo value)

| city | method | all condos | condo 1-3 units | condo 4-8 | condo 9+ |
|---|---|---|---|---|---|
| worcester | flat zoning median (repro) | 0.235 | 0.260 | 0.160 | 0.238 |
| worcester | size curve, typed (new) | 0.224 | 0.125 | 0.078 | 0.245 |
| worcester | size curve, untyped (sens.) | 0.033 | 0.129 | 0.084 | 0.020 |
| springfield | flat zoning median (repro) | 0.121 | 0.400 | 0.085 | 0.114 |
| springfield | size curve, typed (new) | 0.108 | 0.285 | 0.035 | 0.105 |
| springfield | size curve, untyped (sens.) | 0.014 | 0.288 | 0.036 | 0.006 |
| fitchburg | flat zoning median (repro) | 0.141 | 0.253 | 0.276 | 0.128 |
| fitchburg | size curve, typed (new) | 0.138 | 0.157 | 0.067 | 0.140 |
| fitchburg | size curve, untyped (sens.) | 0.022 | 0.159 | 0.070 | 0.010 |
| leominster | flat zoning median (repro) | 0.233 | 0.227 | 0.186 | 0.236 |
| leominster | size curve, typed (new) | 0.047 | 0.180 | 0.075 | 0.040 |
| leominster | size curve, untyped (sens.) | 0.023 | 0.182 | 0.078 | 0.013 |

## Assessor land share of comparable non-condo types

| city | 2-3F (assessor) | Apts 4-8 (assessor) | Apts 9+ (assessor) |
|---|---|---|---|
| worcester | 0.172 | 0.115 | 0.349 |
| springfield | 0.157 | 0.090 | 0.155 |
| fitchburg | 0.195 | 0.149 | 0.281 |
| leominster | 0.240 | 0.190 | 0.084 |

## Notes on the reproduction
- Residential columns and Vacant+parking match the published numbers within ±0.35 pp. SF $ matches within $4 (Fitchburg C50 is off by $9), so the published rows almost certainly used a flat $/sqft condo land estimate at roughly zoning-district level.
- **Office+industrial does not reproduce**: it is off by −7.9 (Worcester), −2.6 (Springfield), −3.3/−4.1 (Fitchburg) and −1.5/−1.8 (Leominster) pp. Retail is off by +0.3 to +0.8, and by −2.4/−2.7 in Leominster. An exhaustive search over code subsets (for example 340/341/343, 400–404, 41x–43x, 316, 35x, mixed 04x) found no natural list that matches all six rows within 1 pp. Also, uniform shifts from changing class composition (mixed-use or chapter-land handling, OTHER_VAL taxed fully) made things worse. So the original's commercial code lists and/or data vintage are unknown. I kept the lists above. Condo land does not affect the C-class A50 columns.
- Fitchburg may differ partly because the current file is FY27.

## New results: what changes
- **Worcester**: Condo goes from −7.6 to −3.2. Large complexes (4,284 of 5,001 units are in 9+ unit buildings) get more land on the apartment schedule. Small condo buildings get less. SF effects barely move.
- **Springfield / Fitchburg**: small changes. Condo goes from −7.4 to −7.6 (Springfield) and from −6.9 to −9.0 (Fitchburg).
- **Leominster**: large change. Condo goes from −7.1 to −17.5, SF owner-proxy from +2.6% to +4.0% and the $ column from $157 to $246 (A50). Leominster's assessor values 9+ unit apartment land at only about $2.6/sqft, against about $11/sqft for the flat house-lot median applied to condo complexes of typically 1.5–12 acres. The flat method over-predicted 112 land by e^1.5 (4.5×) in holdout, so the published Leominster condo land was very likely too high.
- **Aggregate condo land share** (Σ imputed land / Σ condo value), flat → new: Worcester 23.5% → 22.4%, Springfield 12.1% → 10.8%, Fitchburg 14.1% → 13.8%, Leominster 23.3% → 4.7%. Small (1–3 unit) condo buildings drop in every city, for example Worcester 26% → 12.5% against an assessor 2-3F land share of 17%. This is because condo units are assessed higher than 2-3F houses on the same lot.

## Caveats
- The condo land target cannot be validated directly, since L3 has no condo land. Validation is on non-condo parcels, and the 9+ unit schedule rests on 36–133 apartment parcels per city (holdout MdAE 0.26–0.43). Using the 112 schedule for condo complexes is a judgment call. The bounds are the untyped curve (house-lot schedule, very low land) and the flat median (high land); see Sensitivity.
- The owner proxy is a mailing-address match. No residential exemption is modelled. Personal property is not in L3.
- The Fitchburg FY27 data is paired with an unverified FY26 rate, so treat Fitchburg $ figures as approximate.
