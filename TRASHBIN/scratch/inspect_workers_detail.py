import os
import json

workers = [
    ('worker_m30_compiler', '978a309f-cb16-4d32-87c0-11f0a46f1d84'),
    ('worker_m31_plotter', '6fdd874f-f590-444c-8980-a0ca3402a1c3'),
    ('worker_m32_ide_sync', '159e3667-67a7-40dd-95e9-ef94851442b3'),
    ('test_writer_pinescript_v6', '49b88ed9-6a31-4b29-a18d-7b7e12e3e01c')
]

for name, cid in workers:
    log_path = f'C:/Users/gocha/.gemini/antigravity/brain/{cid}/.system_generated/logs/transcript.jsonl'
    if os.path.exists(log_path):
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = [json.loads(l) for l in f if l.strip()]
        planners = [l for l in lines if l.get('type') == 'PLANNER_RESPONSE']
        if planners:
            last = planners[-1]
            print(f"=== {name} (steps: {len(lines)}) ===")
            for t in last.get('tool_calls', []):
                t_name = t.get('name')
                d = t.get('args', {}).get('Description') or t.get('args', {}).get('toolSummary') or t.get('args', {}).get('toolAction') or ''
                tgt = t.get('args', {}).get('TargetFile') or t.get('args', {}).get('AbsolutePath') or t.get('args', {}).get('CommandLine') or ''
                print(f"  [{t_name}] {d} -> {tgt}")
            th = str(last.get('thinking', ''))[-200:].replace('\n', ' ')
            if th:
                print(f"  Thinking: {th}")
            cnt = str(last.get('content', ''))[:150].replace('\n', ' ')
            if cnt:
                print(f"  Content: {cnt}")
            print()
