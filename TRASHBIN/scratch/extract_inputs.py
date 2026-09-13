import json

log_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\.system_generated\logs\transcript.jsonl"
inputs = []

with open(log_path, "r", encoding="utf-8") as f:
    for line in f:
        if '"type":"USER_INPUT"' in line:
            try:
                data = json.loads(line)
                inputs.append({
                    "step_index": data.get("step_index"),
                    "created_at": data.get("created_at"),
                    "content": data.get("content")
                })
            except Exception:
                pass

with open(r"e:\TRADINGVIEW ADVANCED\scratch\all_user_inputs.txt", "w", encoding="utf-8") as out:
    for idx, inp in enumerate(inputs):
        out.write(f"=== INPUT {idx+1} [step {inp['step_index']}] at {inp['created_at']} ===\n")
        out.write(inp["content"] + "\n\n")

print(f"Extracted {len(inputs)} inputs successfully")
