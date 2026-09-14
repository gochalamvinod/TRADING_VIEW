import os
import glob
import re
import json

def main():
    bundle_path = r'E:\TRADINGVIEW ADVANCED\charting_library\bundles'
    bundle_files = glob.glob(os.path.join(bundle_path, '*.js'))

    config_flag_patterns = [
        re.compile(r'configFlags\.([a-zA-Z0-9_$]+)'),
        re.compile(r'_configFlags\.([a-zA-Z0-9_$]+)'),
        re.compile(r'configFlags\s*\[\s*["\']([a-zA-Z0-9_$]+)["\']\s*\]'),
        re.compile(r'_configFlags\s*\[\s*["\']([a-zA-Z0-9_$]+)["\']\s*\]'),
    ]

    all_flags = {}

    # Load defaults from Ie first
    with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\default_config_flags.json', 'r', encoding='utf-8') as f:
        ie_flags = json.load(f)

    for k, v in ie_flags.items():
        all_flags[k] = {
            "default": v,
            "seen_in": ["trading.5355aa53ba59846168ee.js (default table)"]
        }

    # Now scan all bundles for configFlags access
    for p in bundle_files:
        bname = os.path.basename(p)
        with open(p, 'r', encoding='utf-8') as f:
            content = f.read()

        for pat in config_flag_patterns:
            for m in pat.finditer(content):
                flag = m.group(1)
                # Ignore JS builtins or short minified properties if any
                if flag in ['length', 'constructor', 'prototype', 'toString', 'indexOf']:
                    continue
                if flag not in all_flags:
                    all_flags[flag] = {"default": "undefined", "seen_in": []}
                if bname not in all_flags[flag]["seen_in"]:
                    all_flags[flag]["seen_in"].append(bname)

        # In trading.5355aa53ba59846168ee.js, G = e.metainfo().configFlags
        if 'trading.5355aa53ba59846168ee.js' in bname:
            # Find all G.xxx where G is configFlags
            # G = e.metainfo().configFlags; ... G.supportXYZ
            for m in re.finditer(r'G\.(support[a-zA-Z0-9_$]+|show[a-zA-Z0-9_$]+|[a-zA-Z0-9_$]+Order[a-zA-Z0-9_$]+)', content):
                flag = m.group(1)
                if flag not in all_flags:
                    all_flags[flag] = {"default": "undefined", "seen_in": []}
                if bname not in all_flags[flag]["seen_in"]:
                    all_flags[flag]["seen_in"].append(bname)

    # Let's also search for deprecated flags mentioned in patchConfig
    # e.g. supportBrackets, supportModifyOrder
    for m in re.finditer(r't\.hasOwnProperty\(["\'](support[a-zA-Z0-9_$]+)["\']\)', content):
        flag = m.group(1)
        if flag not in all_flags:
            all_flags[flag] = {"default": "deprecated", "seen_in": []}
        all_flags[flag]["seen_in"].append("patchConfig")

    print(f"Total Broker Adapter configFlags discovered: {len(all_flags)}")
    for k in sorted(all_flags.keys()):
        print(f"  {k} (default: {all_flags[k]['default']}) -> seen in {len(all_flags[k]['seen_in'])} files")

    with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\discovered_config_flags.json', 'w', encoding='utf-8') as f:
        json.dump(all_flags, f, indent=2)

if __name__ == '__main__':
    main()
