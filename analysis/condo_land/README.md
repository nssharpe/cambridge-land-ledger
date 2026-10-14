# Condo land estimate

Condo units carry $0 land value in the City's open data, and the master condo parcel (class 199, `CONDO-BLDG`) carries none either. The site needs a land/building split for every unit, so it estimates each condo building's land and shares it among the units.

## Method

The Assessor's land values on non-condo lots follow a tight pattern. Within a tax district × zoning cell, land value rises with lot size less than proportionally, and lots with more units carry somewhat more land value.

- **Buildings of 1 to 3 units:** `log(land) = cell + 0.380 · log(lot sq ft)`. This is fit on one- to three-family and 4-to-8-unit lots.
- **Buildings of 4 or more units:** `log(land) = cell + 0.354 · log(lot) + 0.089 · log(units) + 0.095 · (log(lot) − 8.3) · log(units)`. This is fit on all non-condo residential lots: one- to three-family, 4-to-8 and 9+ unit apartments, and multi-use residential.

Building land is shared among the units in proportion to the existing split, which is by assessed value, with each unit capped at 90% of its value.

## Validation (`validation.json`)

| Check | Old method (flat median $/sq ft × lot) | New method |
|---|---|---|
| 5-fold CV, non-condo lots, typical error | 19% | 4% (1–3 family), 6% (all) |
| 379 lots converted to condos, FY2015–FY2025: bias | 12% high | none |
| Same, typical error, 2–3 units / 4+ units | 21% / 48% | 4% / 21% |
| Same, lots of 5,000 sq ft or more: bias | 33% high | 1% high |

"Converted" means the lot was a house or apartment building in the last year before conversion and is a condo building in FY2026. Its truth value is the Assessor's land value in that year, grown to FY2026 by the median land change of unchanged lots in the same tax district.

Large condo buildings are the least certain. Few of them were ever apartments, and in cross-validation the 4+ unit curve undervalues 9+ unit apartment lots by about 12%.

The site's sensitivity band moves small-building land by ±10% and large-building land by −20% to +30%. Across that band, the 50% building-exemption medians stay between +10% and +13% for owner-occupied single-family homes and between −10% and −16% for condos. Splitting land among units by living area instead of value changes no group median by more than 1 point.

## Running it

The site's data files come from the analysis pipeline, which is not in this repo (`analysis/model.py` and `site/build_data.py` in the author's local project). `model.py` calls `estimator.py`:

- `estimate_building_land(rows)` runs on the FY2026 property database CSV read as strings (`csv.DictReader`; pandas NaNs break the fit). Multiplied by the condo-land sensitivity factor.
- Building land is shared by assessed value among all of the building's land-0 units (`allocate_to_units` does the same for `*CONDO` classes), capped at 90% of each unit's value. Units joined to their parent by map-lot prefix share it too.
- Falls back to the old flat median $/sq ft method for 7 buildings with no estimate (6 in tax district R1A, which has no non-condo residential lots to fit, with 1,413 units; 1 parent record with no GISID, 3 units), 22 buildings where non-condo-class units (MULTI UNIT CNDO, RESRCH IND CND, exempt units) hold over half the value (101 units), and 140 units whose parent record has no land area.

Rebuild: `python analysis/model.py`, then `python site/build_data.py --reference <tmp>/ref.json` and `node site/tests/validate_calc.js <tmp>/ref.json`. Copy only `calc.json`, `parcels.json` and `summary.json` into this repo: `build_data.py` rebuilds the other-city rows of `cities.json` from the earlier model run's table, so take only its Cambridge row.

`apply_condo_land.py` (below) is superseded. It rescaled the earlier data files to the predicted building land and is kept for the record.

```
# 1. FY2015–FY2026 assessor CSVs and FY2026 parcels from github.com/cambridgegis/cambridgegis_data (Assessing/)
python3 fit_validate.py <cambridgegis_data> <out_dir>          # writes condo_land_pred.json, validation.json
python3 join_features.py <site> <ASSESSING_ParcelsFY2026.geojson> <out_dir>/feat_ml.json   # map features -> map-lot
# 2. (superseded) Rescale condo land in the site's data files (reads the previous data files from <orig_data_dir>)
python3 apply_condo_land.py <site> <orig_data_dir> <out_dir>/feat_ml.json <out_dir>/condo_land_pred.json
```

`join_features.py` needs `shapely`. `estimator.py` reproduces `fit_validate.py` exactly.
