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

print("Calling Web App URL:", apps_script_url)
try:
    resp = requests.post(apps_script_url, json={"action": "get_config"}, timeout=30)
    print("Response Status:", resp.status_code)
    data = resp.json()
    if data.get("status") == "ok":
        print(json.dumps(data["config"], indent=2, ensure_ascii=False))
    else:
        print("Error:", data.get("message"))
except Exception as e:
    print("Exception:", e)
