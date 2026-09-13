import json
import os
import re

with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\discovered_features.json', 'r', encoding='utf-8') as f:
    feat_data = json.load(f)

features = feat_data['master_features']
subsets_map = feat_data['subsets_map']
checked_in_bundles = feat_data['checked_in_bundles']

with open(r'E:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_m20_3\discovered_config_flags.json', 'r', encoding='utf-8') as f:
    config_flags = json.load(f)

# Read index.html to find currently enabled and disabled features, and configFlags
with open(r'E:\TRADINGVIEW ADVANCED\index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

# Extract disabled_features in index.html
m_dis = re.search(r'disabled_features\s*:\s*\[(.*?)\]', index_html, re.DOTALL)
index_disabled_features = set()
if m_dis:
    index_disabled_features = set(re.findall(r'["\']([a-zA-Z0-9_-]+)["\']', m_dis.group(1)))

# Extract enabled_features in index.html
m_en = re.search(r'enabled_features\s*:\s*\[(.*?)\]', index_html, re.DOTALL)
index_enabled_features = set()
if m_en:
    index_enabled_features = set(re.findall(r'["\']([a-zA-Z0-9_-]+)["\']', m_en.group(1)))

# Extract configFlags in index.html
m_flags = re.search(r'configFlags\s*:\s*\{(.*?)\}', index_html, re.DOTALL)
index_config_flags = {}
if m_flags:
    for line in m_flags.group(1).split('\n'):
        line = line.strip()
        if not line or line.startswith('//'):
            continue
        parts = line.split(':')
        if len(parts) == 2:
            k = parts[0].strip()
            v = parts[1].strip().rstrip(',')
            index_config_flags[k] = v

print(f"index.html enabled features count: {len(index_enabled_features)}")
print(f"index.html disabled features count: {len(index_disabled_features)}")
print(f"index.html configFlags count: {len(index_config_flags)}")

# Read mt5_broker.js to check implemented methods and configFlags
with open(r'E:\TRADINGVIEW ADVANCED\mt5_broker.js', 'r', encoding='utf-8') as f:
    mt5_broker_code = f.read()

print("Analyzed index.html and mt5_broker.js successfully.")
