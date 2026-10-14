"""Replace the site's condo land estimate with the lot-size-aware estimate.
Rescales each condo building's land (shared by its condo, office-condo and retail-condo units)
to the predicted building land, keeping the existing within-building split and the 90% cap.
Usage: python3 apply_condo_land.py <site_dir> <orig_data_dir> <feat_ml.json> <condo_land_pred.json>
"""
import json, statistics as st, sys
from collections import defaultdict
site, orig, mlp, predp = sys.argv[1:5]
d = json.load(open(f"{orig}/calc.json")); P = json.load(open(f"{orig}/parcels.json")); S = json.load(open(f"{orig}/summary.json"))
ml = json.load(open(mlp)); pred = json.load(open(predp))
ug = d["use_groups"]; CT = {ug.index(x) for x in ("condo", "office condo", "retail condo")}
byf = defaultdict(list)
for i, m in enumerate(d["m"]):
    if d["g"][i] in CT: byf[m].append(i)
scale = {}
for m, idx in byf.items():
    old = sum(d["L"][i] for i in idx)
    if m >= 0 and ml[m] in pred and old > 0 and pred[ml[m]]["new"] == pred[ml[m]]["new"]:
        scale[m] = pred[ml[m]]["new"] / old
fallback = st.median(scale.values())
print(f"buildings rescaled from prediction: {len(scale)}; fallback ratio {fallback:.3f} for {len(byf) - len(scale)} groups")
L = list(d["L"]); B = list(d["B"]); oldL = list(d["L"])
for m, idx in byf.items():
    k = scale.get(m, fallback)
    for i in idx:
        v = d["L"][i] + d["B"][i]
        nl = min(d["L"][i] * k, 0.9 * v)
        L[i] = round(nl, 2); B[i] = round(v - nl, 2)
d["L"], d["B"] = L, B
json.dump(d, open(f"{site}/data/calc.json", "w"), separators=(",", ":"))
# parcels.json: land $/sf and building-per-$1-land for affected features
fl = defaultdict(lambda: [0.0, 0.0, 0.0]); 
for i, m in enumerate(d["m"]):
    if m >= 0: fl[m][0] += oldL[i]; fl[m][1] += L[i]; fl[m][2] += B[i]
changed = 0
for m in byf:
    if m < 0 or fl[m][0] <= 0: continue
    if P["lpsf"][m] is not None: P["lpsf"][m] = round(P["lpsf"][m] * fl[m][1] / fl[m][0], 1)
    if P["ratio"][m] is not None: P["ratio"][m] = round(fl[m][2] / fl[m][1], 2); changed += 1
json.dump(P, open(f"{site}/data/parcels.json", "w"), separators=(",", ":"))
# summary.json
dL = sum(L) - sum(oldL)
dL_condo = sum(L[i] - oldL[i] for i in range(len(L)) if d["g"][i] == ug.index("condo"))
dL_cip = dL - dL_condo  # office/retail condos sit in "Labs and offices" / "Shops..." categories
S["land_all"] += dL; S["bldg_all"] -= dL; S["land_taxable"] += dL; S["bldg_taxable"] -= dL
S["land_share_taxable"] = S["land_taxable"] / (S["land_taxable"] + S["bldg_taxable"])
oc = d["use_groups"].index("office condo"); rc = d["use_groups"].index("retail condo")
d_off = sum(L[i] - oldL[i] for i in range(len(L)) if d["g"][i] == oc)
d_ret = sum(L[i] - oldL[i] for i in range(len(L)) if d["g"][i] == rc)
for c in S["land_by_category"]:
    if c["category"] == "Condos": c["land"] += dL_condo
    if c["category"] == "Labs and offices": c["land"] += d_off
    if c["category"].startswith("Shops"): c["land"] += d_ret
for c in S["land_by_category"]: c["share"] = c["land"] / S["land_all"]
S["land_by_category"].sort(key=lambda c: -c["land"])
taxable_psf = [P["lpsf"][m] for m in range(len(P["lpsf"])) if P["status"][m] == 1 and P["lpsf"][m] is not None]
S["median_land_psf_taxable_parcels"] = round(st.median(taxable_psf), 1)
json.dump(S, open(f"{site}/data/summary.json", "w"), indent=1)
cl_old = sum(oldL[i] for i in range(len(L)) if d["g"][i] == ug.index("condo")); cl_new = cl_old + dL_condo
cv = sum(L[i] + B[i] for i in range(len(L)) if d["g"][i] == ug.index("condo"))
print(f"condo land: ${cl_old/1e9:.2f}B -> ${cl_new/1e9:.2f}B (share of condo value {cl_old/cv:.3f} -> {cl_new/cv:.3f}); office/retail condo land change ${d_off/1e6:.0f}M/${d_ret/1e6:.0f}M")
print(f"land_all ${S['land_all']/1e9:.2f}B, taxable land share {S['land_share_taxable']:.3f}, median taxable land psf {S['median_land_psf_taxable_parcels']}; parcels features updated {changed}")
