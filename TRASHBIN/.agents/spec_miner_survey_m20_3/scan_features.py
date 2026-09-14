import os
import glob
import re
import json

def main():
    bundle_path = r'E:\TRADINGVIEW ADVANCED\charting_library\bundles'
    standalone_path = r'E:\TRADINGVIEW ADVANCED\charting_library\charting_library.standalone.js'

    # 1. Parse module 440891 JSON
    bundle_2614 = os.path.join(bundle_path, '2614.3c6e9a4d2c016c8e0d98.js')
    with open(bundle_2614, 'r', encoding='utf-8') as f:
        c2614 = f.read()

    m = re.search(r'const r=JSON\.parse\(\'({.*?})\'\)', c2614)
    if not m:
        print("Error: Could not find JSON.parse in 2614!")
        return
    feature_map = json.loads(m.group(1))

    all_map_features = set(feature_map.keys())
    subsets_map = {}
    for k, v in feature_map.items():
        if 'subsets' in v:
            subsets_map[k] = v['subsets']
            for s in v['subsets']:
                all_map_features.add(s)

    print(f"Features directly in 440891 map: {len(feature_map)}")
    print(f"Total features in map (including subsets): {len(all_map_features)}")

    # 2. Scan all bundle files
    bundle_files = glob.glob(os.path.join(bundle_path, '*.js'))
    bundle_files.append(standalone_path)
    print(f"Total files to scan: {len(bundle_files)}")

    enabled_regexes = [
        re.compile(r'\.enabled\(["\']([a-zA-Z0-9_-]+)["\']\)'),
        re.compile(r'\(\s*0\s*,\s*[^)]*?\.enabled\)\(["\']([a-zA-Z0-9_-]+)["\']\)'),
        re.compile(r'isFeatureEnabled\(["\']([a-zA-Z0-9_-]+)["\']\)'),
        re.compile(r'setFeatureEnabled\(["\']([a-zA-Z0-9_-]+)["\']'),
        re.compile(r'\.includes\(["\']([a-zA-Z0-9_-]+)["\']\)') # check if enabled_features.includes("...")
    ]

    all_checked_features = {}
    
    for p in bundle_files:
        bname = os.path.basename(p)
        try:
            with open(p, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as ex:
            print(f"Error reading {bname}: {ex}")
            continue

        for r in enabled_regexes[:4]: # only .enabled and isFeatureEnabled
            for match in r.finditer(content):
                feat = match.group(1)
                if feat not in all_checked_features:
                    all_checked_features[feat] = set()
                all_checked_features[feat].add(bname)

        # Also check standalone for iframe_loading features
        if 'charting_library.standalone.js' in bname:
            for match in re.finditer(r'includes\(["\']([a-zA-Z0-9_-]+)["\']\)', content):
                feat = match.group(1)
                if 'iframe_' in feat or feat in all_map_features:
                    if feat not in all_checked_features:
                        all_checked_features[feat] = set()
                    all_checked_features[feat].add(bname)

    print(f"Total unique feature names checked via .enabled() / isFeatureEnabled(): {len(all_checked_features)}")
    
    # Check if there are features checked in code that are not in 440891 map
    extra_checked = set(all_checked_features.keys()) - all_map_features
    print(f"Features checked in code NOT in 440891 map ({len(extra_checked)}): {sorted(list(extra_checked))}")

    # Check features in 440891 map NOT checked via .enabled()
    uncheked_in_map = all_map_features - set(all_checked_features.keys())
    print(f"Features in map NOT directly matching regex ({len(uncheked_in_map)})")

    # Combine everything into Master Feature Catalog
    master_features = all_map_features.union(set(all_checked_features.keys()))
    print(f"\nMASTER TOTAL FEATURES: {len(master_features)}")

    # Save to a json for detailed inspection
    output_data = {
        "master_features": sorted(list(master_features)),
        "feature_map": feature_map,
        "subsets_map": subsets_map,
        "checked_in_bundles": {k: sorted(list(v)) for k, v in all_checked_features.items()}
    }
    with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\discovered_features.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
    print("Saved discovered_features.json successfully.")

if __name__ == '__main__':
    main()
