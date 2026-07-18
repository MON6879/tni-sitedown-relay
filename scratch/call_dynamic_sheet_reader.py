import requests
import json
import sys

with open(".env", "r", encoding="utf-8") as f:
    lines = f.readlines()
    
apps_script_url = ""
for line in lines:
    if line.startswith("APPS_SCRIPT_URL="):
        apps_script_url = line.split("=")[1].strip()
        break

if not apps_script_url:
    print("APPS_SCRIPT_URL not found in .env")
    exit(1)

ss_id = sys.argv[1] if len(sys.argv) > 1 else "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
sheet_name = sys.argv[2] if len(sys.argv) > 2 else "BOD assign"

url = apps_script_url
params = {
    "action": "debug_bod_assign",
    "ssId": ss_id,
    "sheetName": sheet_name
}
print(f"Calling: {url} with params {params}")
try:
    resp = requests.get(url, params=params, timeout=30)
    print("Status:", resp.status_code)
    data = resp.json()
    if data.get("status") == "ok":
        results = data['results']
        print(f"Successfully retrieved {len(results)} rows")
        output_file = f"scratch/dump_{sheet_name.replace(' ', '_')}.txt"
        with open(output_file, "w", encoding="utf-8") as f:
            for row in results:
                row_num = row['rowNum']
                vals = row['values']
                formuls = row['formulas']
                f.write(f"Row {row_num}: Values={vals} | Formulas={formuls}\n")
        print("Wrote output to", output_file)
        
        # Also print rows that have something interesting (e.g. non-empty column O or column A)
        for row in results:
            row_num = row['rowNum']
            vals = row['values']
            # Make sure we have enough columns
            if len(vals) > 14:
                colO = str(vals[14]).strip()
                colN = str(vals[13]).strip()
                colG = str(vals[6]).strip()
                colH = str(vals[7]).strip()
                colI = str(vals[8]).strip()
                colJ = str(vals[9]).strip()
                colK = str(vals[10]).strip()
                colL = str(vals[11]).strip()
                colA = str(vals[0]).strip()
                
                # If Col O is BOD New assign or similar
                if "BOD New assign" in colO or "new assign" in colO.lower() or "BOD New assign" in str(vals):
                    print(f"Row {row_num}: Col A='{colA}' | Col G='{colG}' | Col H='{colH}' | Col I='{colI}' | Col J='{colJ}' | Col K='{colK}' | Col L='{colL}' | Col N='{colN}' | Col O='{colO}'")
    else:
        print("Error:", data.get("message"))
except Exception as e:
    print("Exception:", e)
