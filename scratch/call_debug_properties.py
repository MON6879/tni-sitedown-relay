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

url = f"{apps_script_url}?action=debug_properties"
print("Calling:", url)
try:
    resp = requests.get(url, timeout=30)
    print("Status:", resp.status_code)
    data = resp.json()
    print("Props:")
    import pprint
    pprint.pprint(data)
except Exception as e:
    print("Exception:", e)
