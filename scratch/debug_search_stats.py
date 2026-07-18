"""Test v221 deployment."""
import requests

url = "https://script.google.com/macros/s/AKfycbwi3J0VrrIE91mnPvIUuykPjwGvNc4y9JDxCNPvJTtOmVAvvalDXu5ZwYZmu5jW-fSo0w/exec"
resp = requests.post(url, json={"action": "get_report_data"}, timeout=120)
data = resp.json()

print(f"HTTP {resp.status_code}")
print(f"status: {data.get('status')}")
print(f"searchStats keys: {len(data.get('searchStats', {}))}")
print(f"searchStatsByName keys: {list(data.get('searchStatsByName', {}).keys())}")
ts = data.get("teamSummary", [])
for t in ts:
    nm = t.get("team","?")[-15:]
    print(f"  {nm}: d2={t.get('d2')} d1={t.get('d1')} d0={t.get('today')}")
if not ts:
    print(f"Raw (500): {resp.text[:500]}")
