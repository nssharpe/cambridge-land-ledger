import json, sys
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.strtree import STRtree
site, gisjson, out = sys.argv[1:4]
P = json.load(open(f"{site}/data/parcels.json"))
G = json.load(open(gisjson))
gp, gml = [], []
for f in G["features"]:
    try:
        g = shape(f["geometry"])
        if not g.is_valid: g = g.buffer(0)
        gp.append(g); gml.append(f["properties"]["ML"])
    except Exception: pass
tree = STRtree(gp)
res = []
for geom in P["geom"]:
    polys = [Polygon(r[0], r[1:]) for r in geom]
    g = MultiPolygon(polys) if len(polys) > 1 else polys[0]
    if not g.is_valid: g = g.buffer(0)
    pt = g.representative_point()
    cand = [i for i in tree.query(pt) if gp[i].contains(pt)]
    if not cand:  # fallback: max overlap
        cand = sorted(tree.query(g), key=lambda i: -gp[i].intersection(g).area)[:1]
    res.append(gml[cand[0]] if cand else None)
json.dump(res, open(out, "w"))
print("features", len(res), "matched", sum(r is not None for r in res), "unique", len(set(res)))
