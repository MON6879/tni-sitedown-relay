"""Test v222: doGet get_msgids + doPost get_report_data."""
import requests

base = "https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec"

# Test 1: GET get_msgids (đây là thứ delete_old_helper dùng)
r1 = requests.get(base, params={"action": "get_msgids", "key": "CRON_TEAM_T2"}, timeout=30)
print(f"GET get_msgids: HTTP {r1.status_code} → {r1.text[:200]}")

# Test 2: POST get_report_data (search stats)
r2 = requests.post(base, json={"action": "get_report_data"}, timeout=120)
d2 = r2.json()
print(f"\nPOST get_report_data: status={d2.get('status')} searchByName={len(d2.get('searchStatsByName',{}))} keys")
for ts in d2.get("teamSummary", []):
    t = ts.get("team","?")[-15:]
    print(f"  {t}: d2={ts.get('d2')} d1={ts.get('d1')} d0={ts.get('today')}")
