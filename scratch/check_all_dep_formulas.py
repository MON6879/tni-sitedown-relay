import requests

with open(".env", "r", encoding="utf-8") as f:
    lines = f.readlines()
    
apps_script_url = ""
for line in lines:
    if line.startswith("APPS_SCRIPT_URL="):
        apps_script_url = line.split("=")[1].strip()
        break

deps = {
    "Finance + HR": "1ydr9mIjcNVzRHwaZf0UnZHQjSjDN0jNP-5DZILYOe6g",
    "CM": "18sBZ8znvOtoIP_Dzn8mLmqRcLGDPXls8ZBv7plGpFbw",
    "PM": "1-qK2_-lmsEwZaosMoNPnkh3DFPFviwqqN1PoG8Alh_g",
    "Asset": "1W0vcVagudFuCjwEMkqtiaL5GclZyKdP8F13XdVTlJmk",
    "M&E": "1VZZeNcgHm6GG-fAaO22ILPWHJnVWUaYqCd_v7KE21qw",
    "Admin": "17EY19Y5KBxnaB3GQRNxE1xcRBuGh2LAUmJIk2HaK3_w",
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
        if data.get("status") == "ok" and len(data['results']) > 2:
            # Cell A3 formula is at row index 2 (row 3)
            row3 = data['results'][2]
            formulas = row3['formulas']
            formula_colA = formulas[0] if len(formulas) > 0 else "None"
            val_colA = row3['values'][0] if len(row3['values']) > 0 else "None"
            print(f"Dep: {name} | A3 Val: {val_colA} | Formula: {formula_colA}")
        else:
            print(f"Dep: {name} | Error or empty: {data.get('message')}")
    except Exception as e:
        print(f"Dep: {name} | Exception: {e}")
