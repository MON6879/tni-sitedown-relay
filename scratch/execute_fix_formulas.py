import requests

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

url = apps_script_url
params = {
    "action": "fix_bod_assign"
}
print(f"Calling: {url} with params {params}")
try:
    resp = requests.get(url, params=params, timeout=30)
    print("Status:", resp.status_code)
    print("Response:", resp.text)
except Exception as e:
    print("Exception:", e)
