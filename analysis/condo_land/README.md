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

## Check: value shares vs. master-deed percentage interests

The model shares each building's land among its units by assessed value. Under M.G.L. c. 183A, each unit legally owns its percentage interest in the common elements, set in the master deed. To test the difference, I transcribed the percentage interests for a sample of 25 condo buildings (261 taxable units) from the Middlesex South Registry of Deeds. For the larger buildings I searched the registry index for amendments and used the latest set that restates the percentages. For several small buildings the figures come from the master deed or a unit deed, without an amendment search, and one multi-parcel condominium's amendments weren't checked. The unit-level file stays out of git because it lists unit numbers. `deed_check.py` compares the two splits and prints only aggregates.

Both splits are normalized over the same units in each building. Each split gets the model's building land, with the same 90% cap. Bills are at a 50% building exemption, with both classes and the 30% residential exemption.

| Building size | Buildings | Units | Mean abs. gap in unit share | Mean relative gap | Median elasticity of deed share to value share* | Median abs. bill change | Units with bill change > 5% / > 10% |
|---|---|---|---|---|---|---|---|
| 2-3 units | 8 | 18 | 3.4 pts | 7% | 0.94 | 1.1% ($50) | 22% / 6% |
| 4-8 units | 8 | 39 | 1.4 pts | 7% | 1.14 | 1.2% ($47) | 8% / 8% |
| 9+ units | 9 | 204 | 0.5 pts | 9% | 0.66 | 1.8% ($38) | 20% / 8% |
| All | 25 | 261 | 1.7 pts | 8% | 0.94 | 1.5% ($39) | 18% / 8% |

- The median unit's bill moves about 1.5% (about $40 a year) when land is split by percentage interest instead of value. Bills move more than 10% for 8% of units, The largest change is +263%. It's a unit assessed at about a third of its building's average value, and its deed share of land is 3.4 times its value share.
- In 4 of 25 buildings the deeds give every unit the same percentage. Most other deeds set percentages by floor area or by each unit's relative value when the condominium was created, so they roughly track assessed value.
*Excludes the 4 buildings where every unit has the same percentage.

- In large buildings, deed percentages tend to be flatter than assessed values (median elasticity 0.66, ranging from about 0 to 1.3 across buildings). Where that holds, the highest-valued units would carry less land than the model gives them, and the cheapest units more.
- Building land totals stay the same except where the 90% cap binds under the percentage split. That happens for 6 units in 2 buildings and removes $77,000 of land in total. Class and city-wide results are effectively unchanged; the split mostly moves bills within a building.
- Caveats: the sample isn't random, and it's small (8 or 9 buildings per size class). One condominium covers more than one parcel, so I compared its shares within the sampled parcel. A few values were read from poor scans; those are noted in the unit file. Where later amendments didn't restate the percentages, I used the original master deed.
