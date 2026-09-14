import sys

# 1. Update injectLegendPolishStyles in pine_editor_ide.js
with open('pine_editor_ide.js', 'r', encoding='utf-8', errors='ignore') as f:
    ide_code = f.read()

# Add blockHidden suppression into injectLegendPolishStyles
old_polish = '''          /* Enforce nowrap on values wrappers to prevent vertical wrapping */'''
new_polish = '''          /* Strictly hide all blockHidden elements (unlabelled duplicate close price, n/a, duplicate day change) */
          [class*="blockHidden"],
          .blockHidden-e6PF69Df {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Enforce nowrap on values wrappers to prevent vertical wrapping */'''

assert old_polish in ide_code, "old_polish not found in pine_editor_ide.js"
ide_code = ide_code.replace(old_polish, new_polish, 1)

# Ensure default template name is "Sessions [LuxAlgo] by LuxAlgo" and default recents has it
ide_code = ide_code.replace('name: "Sessions [LuxAlgo] (v6)"', 'name: "Sessions [LuxAlgo] by LuxAlgo"')
ide_code = ide_code.replace('const defaults = ["Sessions [LuxAlgo]", "Multi-Session Time Cycles", "TIME CYCLE"];',
                            'const defaults = ["Sessions [LuxAlgo] by LuxAlgo", "Multi-Session Time Cycles", "TIME CYCLE"];')

with open('pine_editor_ide.js', 'w', encoding='utf-8') as f:
    f.write(ide_code)

print("Updated legend polish and default template name in pine_editor_ide.js")
