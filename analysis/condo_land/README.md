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

```
# 1. FY2015–FY2026 assessor CSVs and FY2026 parcels from github.com/cambridgegis/cambridgegis_data (Assessing/)
python3 fit_validate.py <cambridgegis_data> <out_dir>          # writes condo_land_pred.json, validation.json
python3 join_features.py <site> <ASSESSING_ParcelsFY2026.geojson> <out_dir>/feat_ml.json   # map features -> map-lot
# 2. Rescale condo land in the site's data files (reads the previous data files from <orig_data_dir>)
python3 apply_condo_land.py <site> <orig_data_dir> <out_dir>/feat_ml.json <out_dir>/condo_land_pred.json
```

`join_features.py` needs `shapely`. `apply_condo_land.py` rewrites `data/calc.json`, `data/parcels.json` (land $/sq ft and building-per-$1-land for condo buildings) and `data/summary.json`.

`analysis/model.py` and `site/build_data.py` still use the old estimate. They need the same change before the data files are next rebuilt from scratch.
