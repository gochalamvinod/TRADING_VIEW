import json
import os

with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\discovered_features.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

features = data['master_features']
subsets_map = data['subsets_map']
checked_in_bundles = data['checked_in_bundles']

print(f"Master features count: {len(features)}")

# Let's inspect where features appear and their names
for feat in sorted(features):
    parent_of = subsets_map.get(feat, [])
    bundles = checked_in_bundles.get(feat, [])
    print(f"{feat:50} | Subsets: {len(parent_of):2} | Bundles: {len(bundles):2}")
