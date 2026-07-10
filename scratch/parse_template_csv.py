import csv

filepath = r"C:\Users\HA DUC PHONG\.gemini\antigravity\brain\e21819fe-e4ce-4804-95bd-500b43535f49\.system_generated\steps\207\content.md"

with open(filepath, 'r', encoding='utf-8') as f:
    # Skip standard preamble lines
    lines = f.readlines()
    csv_start = 0
    for idx, line in enumerate(lines):
        if line.strip() == "---":
            csv_start = idx + 1
            break
    
    csv_data = "".join(lines[csv_start:])
    reader = csv.reader(csv_data.splitlines())
    for r_idx, row in enumerate(reader):
        print(f"Row {r_idx + 1}: length={len(row)}")
        for c_idx, val in enumerate(row):
            # Print value summary
            val_clean = val.replace('\n', ' ')
            if len(val_clean) > 40:
                val_clean = val_clean[:37] + "..."
            print(f"  Col {chr(65+c_idx)} ({c_idx+1}): '{val_clean}'")
