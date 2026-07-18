import requests

with open(".env", "r", encoding="utf-8") as f:
    lines = f.readlines()
    
apps_script_url = ""
for line in lines:
    if line.startswith("APPS_SCRIPT_URL="):
        apps_script_url = line.split("=")[1].strip()
        break

deps = {
    "CM": "18sBZ8znvOtoIP_Dzn8mLmqRcLGDPXls8ZBv7plGpFbw",
    "M&E": "1VZZeNcgHm6GG-fAaO22ILPWHJnVWUaYqCd_v7KE21qw",
    "Transmission": "1S00hStkuihY6ycwkr7xW-uO1aE_k5T-BBphS3x6yUZE",
}

for name, ss_id in deps.items():
    url = apps_script_url
    params = {
        "action": "debug_bod_assign",
        "ssId": ss_id,
        "sheetName": "1. BOD+MANAGER Assign"
    }
    try:
        resp = requests.get(url, params=params, timeout=30)
        data = resp.json()
        if data.get("status") == "ok":
            results = data['results']
            print(f"\n=== Spreadsheet: {name} ===")
            for idx in range(min(30, len(results))):
                row = results[idx]
                row_num = row['rowNum']
                vals = row['values']
                formuls = row['formulas']
                val_A = vals[0] if len(vals) > 0 else ""
                form_A = formuls[0] if len(formuls) > 0 else ""
                val_F = vals[5] if len(vals) > 5 else "" # Target Date complete
                val_H = vals[7] if len(vals) > 7 else "" # Dep update Date complete
                val_O = vals[14] if len(vals) > 14 else "" # Column O
                if val_A or form_A or val_O:
                    print(f"Row {row_num}: Col A='{val_A}' Formula='{form_A}' | Col F (Date Target)='{val_F}' | Col H (Date Complete)='{val_H}' | Col O='{val_O}'")
        else:
            print(f"Dep: {name} | Error: {data.get('message')}")
    except Exception as e:
        print(f"Dep: {name} | Exception: {e}")
