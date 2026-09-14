import os
import re
import json

def main():
    p = r'E:\TRADINGVIEW ADVANCED\charting_library\bundles\trading.5355aa53ba59846168ee.js'
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()

    # Find definition of Ie
    m = re.search(r'const\s+Ie\s*=\s*\{([^}]+)\}', c)
    if m:
        body = m.group(1)
        flags = {}
        for line in body.split(','):
            line = line.strip()
            if not line:
                continue
            parts = line.split(':')
            if len(parts) == 2:
                key = parts[0].strip()
                val = parts[1].strip()
                flags[key] = val
        print(f"Default configFlags in Ie ({len(flags)}):")
        for k, v in flags.items():
            print(f"  {k}: {v}")

        with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\default_config_flags.json', 'w', encoding='utf-8') as out:
            json.dump(flags, out, indent=2)
    else:
        print("Could not find const Ie={...}")

if __name__ == '__main__':
    main()
