"""
Set GITHUB_TOKEN in GAS via Apps Script REST API (devMode false).
"""
import json, requests, os, sys

SCRIPT_ID  = "1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR"
CLASPRC    = os.path.expanduser(r"~\.clasprc.json")
TOKEN_ARG  = sys.argv[1] if len(sys.argv) > 1 else ""

with open(CLASPRC) as f:
    creds = json.load(f)["tokens"]["default"]

# Refresh access token
def get_token():
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "grant_type": "refresh_token",
        "refresh_token": creds["refresh_token"],
        "client_id": creds["client_id"],
        "client_secret": creds["client_secret"],
    }, timeout=15)
    if r.ok:
        t = r.json().get("access_token")
        print(f"✅ Token refreshed")
        return t
    print(f"❌ Refresh failed: {r.text[:200]}")
    return creds["access_token"]

def run_func(access_token, func, params=None, dev=False):
    url = f"https://script.googleapis.com/v1/scripts/{SCRIPT_ID}:run"
    r = requests.post(url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        json={"function": func, "parameters": params or [], "devMode": dev},
        timeout=30
    )
    return r.status_code, r.json() if r.headers.get("content-type","").startswith("application/json") else r.text

access_token = get_token()

# Try set token
print(f"\n--- Step 1: setGitHubTokenProp_ (devMode=False) ---")
code, res = run_func(access_token, "setGitHubTokenProp_", [TOKEN_ARG], dev=False)
print(f"HTTP {code}: {json.dumps(res, indent=2) if isinstance(res,dict) else res}")

if code != 200:
    print(f"\n--- Retry: devMode=True ---")
    code, res = run_func(access_token, "setGitHubTokenProp_", [TOKEN_ARG], dev=True)
    print(f"HTTP {code}: {json.dumps(res, indent=2) if isinstance(res,dict) else res}")

if code == 200 and (not isinstance(res, dict) or "error" not in res):
    print("\n✅ Token saved! Now running setupDailyReportTrigger...")
    code2, res2 = run_func(access_token, "setupDailyReportTrigger", [], dev=True)
    print(f"HTTP {code2}: {json.dumps(res2, indent=2) if isinstance(res2,dict) else res2}")
    if code2 == 200:
        print("✅ TRIGGER CREATED — 16:00 Myanmar daily!")
else:
    print("\n❌ Failed. Check: https://console.cloud.google.com/apis/library/script.googleapis.com")
    print("   Enable 'Apps Script API' in GCP Console for project linked to this script")
