#!/bin/sh
# End to end. Requires: pip install pandas numpy scipy geopandas pyogrio shapely
set -e
cd "$(dirname "$0")"
./fetch_data.sh
python3 validate_land.py > validation_output.txt
python3 run_all.py "${1:-/home/user/cambridge-land-ledger/data/cities.json}" > run_output.txt
echo "wrote cities_new.json cities_reproduced.json tables.md validation.csv validation_output.txt"
