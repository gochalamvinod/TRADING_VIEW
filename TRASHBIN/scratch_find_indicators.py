import re, os

bundles_dir = r"e:\TRADINGVIEW ADVANCED\charting_library\bundles"

# Patterns to find study/indicator IDs
patterns = [
    r'([A-Za-z][A-Za-z0-9_ ]+)@tv-basicstudies',
    r'([A-Za-z][A-Za-z0-9_ ]+)@tv-prostudies',
    r'([A-Za-z][A-Za-z0-9_ ]+)@tv-volumebyprice',
    r'([A-Za-z][A-Za-z0-9_ ]+)@tv-',
    r'shortDescription:"([^"]+)"',
    r"shortDescription:'([^']+)'",
]

target_files = [
    "library-studies.fca0ee09201de497a9cb.js",
    "studies.df9d03d5d71d89aed43c.js",
]

all_ids = set()
all_names = set()

for fname in target_files:
    fpath = os.path.join(bundles_dir, fname)
    if not os.path.exists(fpath):
        print(f"SKIP: {fname}")
        continue
    data = open(fpath, "r", encoding="utf-8", errors="ignore").read()
    print(f"\n=== {fname} ({len(data):,} bytes) ===")
    
    # Extract @tv- identifiers
    ids = re.findall(r'([A-Za-z][A-Za-z0-9_ ]{2,50})@tv-\w+', data)
    for i in sorted(set(ids)):
        all_ids.add(i)
    
    # Extract shortDescription values
    names = re.findall(r'shortDescription:"([^"]{2,80})"', data)
    for n in sorted(set(names)):
        all_names.add(n)

print("\n\n========== ALL STUDY IDs (@tv-*) ==========")
for x in sorted(all_ids):
    print(f"  {x}")

print(f"\n========== ALL shortDescription VALUES ==========")
for x in sorted(all_names):
    print(f"  {x}")

# Also scan library.*.js for study registrations
lib_files = [f for f in os.listdir(bundles_dir) if f.startswith("library.") and f.endswith(".js")]
for fname in lib_files:
    fpath = os.path.join(bundles_dir, fname)
    data = open(fpath, "r", encoding="utf-8", errors="ignore").read()
    lib_ids = re.findall(r'([A-Za-z][A-Za-z0-9_ ]{2,50})@tv-\w+', data)
    lib_names = re.findall(r'shortDescription:"([^"]{2,80})"', data)
    new_ids = set(lib_ids) - all_ids
    new_names = set(lib_names) - all_names
    if new_ids or new_names:
        print(f"\n=== Additional from {fname} ===")
        for x in sorted(new_ids):
            print(f"  ID: {x}")
            all_ids.add(x)
        for x in sorted(new_names):
            print(f"  Name: {x}")
            all_names.add(x)

print(f"\nTotal unique study IDs: {len(all_ids)}")
print(f"Total unique indicator names: {len(all_names)}")
