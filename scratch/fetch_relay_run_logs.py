import os
import requests
import zipfile
import io

pat = "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"
owner = "phonghdpxd-cmd"
repo = "TNI-SITE-DOWN"

# Fetch latest run ID first
url_runs = f"https://api.github.com/repos/{owner}/{repo}/actions/runs?per_page=1"
headers = {
    "Authorization": f"token {pat}",
    "Accept": "application/vnd.github.v3+json"
}
resp_runs = requests.get(url_runs, headers=headers)
if resp_runs.status_code == 200:
    run_id = resp_runs.json()["workflow_runs"][0]["id"]
    print(f"Latest run ID: {run_id}")
else:
    print("Failed to fetch runs")
    exit(1)

url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}/logs"
resp = requests.get(url, headers=headers)
if resp.status_code == 200:
    zip_file = zipfile.ZipFile(io.BytesIO(resp.content))
    for name in zip_file.namelist():
        print(f"Log file: {name}")
        content = zip_file.read(name).decode("utf-8", errors="ignore")
        # print last 100 lines of the log
        lines = content.split("\n")
        print("\n".join(lines[-100:]))
        print("="*40)
else:
    print(f"Failed to fetch logs: {resp.status_code} - {resp.text}")
