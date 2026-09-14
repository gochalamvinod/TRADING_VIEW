import json
import os

root_dir = r"E:\TRADINGVIEW ADVANCED"
pine_file = os.path.join(root_dir, "pine_examples", "Sessions_LuxAlgo.pine")
ide_file = os.path.join(root_dir, "pine_editor_ide.js")
cat_file = os.path.join(root_dir, "pine_indicators_catalog.json")

with open(pine_file, "r", encoding="utf-8") as f:
    pine_code = f.read()

# 1. Update pine_editor_ide.js
with open(ide_file, "r", encoding="utf-8") as f:
    ide_content = f.read()

target_anchor = "const TEMPLATES = ["
if "sessions_luxalgo" not in ide_content and target_anchor in ide_content:
    # Escape backticks and backslashes for template literal
    escaped_code = pine_code.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    new_template_entry = f"""  const TEMPLATES = [
    {{
      id: "sessions_luxalgo",
      name: "Sessions [LuxAlgo] (v6)",
      code: `{escaped_code}`
    }},"""
    ide_content = ide_content.replace(target_anchor, new_template_entry, 1)
    with open(ide_file, "w", encoding="utf-8") as f:
        f.write(ide_content)
    print("[OK] Added Sessions [LuxAlgo] (v6) to TEMPLATES in pine_editor_ide.js")
else:
    print("[SKIP] Already in pine_editor_ide.js or anchor not found")

# 2. Update pine_indicators_catalog.json
if os.path.exists(cat_file):
    with open(cat_file, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    
    if not any(x.get("name") == "Sessions [LuxAlgo]" or x.get("baseName") == "Sessions_LuxAlgo" for x in catalog):
        catalog.insert(0, {
            "name": "Sessions [LuxAlgo]",
            "baseName": "Sessions_LuxAlgo",
            "pineName": "Sessions_LuxAlgo.pine",
            "jsName": "Sessions_LuxAlgo.js",
            "shortTitle": "Sessions",
            "overlay": True,
            "plots": [],
            "shapes": [],
            "score": 100
        })
        with open(cat_file, "w", encoding="utf-8") as f:
            json.dump(catalog, f, indent=2)
        print("[OK] Added Sessions [LuxAlgo] to pine_indicators_catalog.json")
    else:
        print("[SKIP] Already in catalog")
