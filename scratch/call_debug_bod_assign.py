import requests
import json

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

url = f"{apps_script_url}?action=debug_bod_assign"
print("Calling:", url)
try:
    resp = requests.get(url, timeout=30)
    data = resp.json()
    if data.get("status") == "ok":
        with open("scratch/bod_assign_full_rows.txt", "w", encoding="utf-8") as f:
            for row in data['results']:
                row_num = row['rowNum']
                colA_val = row['colA_val']
                colA_formula = row['colA_formula']
                colN_val = row['colN_val']
                colO_val = row['colO_val']
                
                f.write(f"Row {row_num}: Col A Val='{colA_val}' Formula='{colA_formula}' | Col N Val='{colN_val}' | Col O Val='{colO_val}'\n")
        print("Successfully wrote full rows to scratch/bod_assign_full_rows.txt")
    else:
        print("Error:", data.get("message"))
except Exception as e:
    print("Exception:", e)
