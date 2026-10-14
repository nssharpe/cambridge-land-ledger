#!/bin/sh
# Download MassGIS L3 per-town shapefiles (assessor table + parcel polygons).
# Vintages used in this run: Worcester FY26 (CY26), Springfield FY26 (CY26),
# Fitchburg FY27 (CY26), Leominster FY26 (CY25) -- whatever is current on S3.
set -e
cd "$(dirname "$0")"
B=https://s3.us-east-1.amazonaws.com/download.massgis.digital.mass.gov/shapefiles/l3parcels
mkdir -p raw
for t in M348_WORCESTER M281_SPRINGFIELD M097_FITCHBURG M153_LEOMINSTER; do
  [ -d raw/$t ] || { curl -sSf -o raw/$t.zip "$B/L3_SHP_$t.zip"; mkdir -p raw/$t; unzip -o -q raw/$t.zip -d raw/$t; }
done
