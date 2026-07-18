import requests, os
from dotenv import load_dotenv
load_dotenv()

REPO  = "phonghdpxd-cmd/tni-bot"
TOKEN = os.getenv("GITHUB_TOKEN", "")
if not TOKEN:
    print("No GITHUB_TOKEN in .env — checking public runs")
    headers = {"Accept": "application/vnd.github+json"}
else:
    headers = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json"}

r = requests.get(
    f"https://api.github.com/repos/{REPO}/actions/runs?per_page=8",
    headers=headers, timeout=15
)
if r.ok:
    for run in r.json().get("workflow_runs", []):
        name   = run.get("name", "?")
        status = run.get("status", "?")
        concl  = run.get("conclusion", "?")
        ctime  = run.get("created_at", "?")
        print(f"{ctime[:16]} | {status:12} | {concl:10} | {name}")
else:
    print(f"API error: {r.status_code}")
    print(r.text[:300])
