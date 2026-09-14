import os
import json

workers = [
    ('sentinel_8', '66240f5c-8cc7-4dc5-8b59-bec66475943c'),
    ('orchestrator_10', '25e28c44-8e5d-46a0-82d2-727cfcc254e4'),
    ('worker_m30_compiler', '978a309f-cb16-4d32-87c0-11f0a46f1d84'),
    ('worker_m31_plotter', '6fdd874f-f590-444c-8980-a0ca3402a1c3'),
    ('worker_m32_ide_sync', '159e3667-67a7-40dd-95e9-ef94851442b3'),
    ('test_writer_pinescript_v6', '49b88ed9-6a31-4b29-a18d-7b7e12e3e01c')
]

for name, cid in workers:
    log_path = f'C:/Users/gocha/.gemini/antigravity/brain/{cid}/.system_generated/logs/transcript.jsonl'
    if os.path.exists(log_path):
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = [line.strip() for line in f if line.strip()]
        last_obj = json.loads(lines[-1]) if lines else {}
        step_type = last_obj.get('type')
        status = last_obj.get('status')
        t_calls = [t.get('name') for t in last_obj.get('tool_calls', [])]
        th = str(last_obj.get('thinking', ''))[:100].replace('\n', ' ')
        cnt = str(last_obj.get('content', ''))[:100].replace('\n', ' ')
        print(f"[{name}] steps={len(lines)} | type={step_type} | status={status} | tools={t_calls}")
        if th:
            print(f"   thinking: {th}...")
        if cnt:
            print(f"   content: {cnt}...")
    else:
        print(f"[{name}] not found")
