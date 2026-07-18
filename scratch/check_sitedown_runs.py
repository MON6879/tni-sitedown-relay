import os
import requests

pat = "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"
owner = "phonghdpxd-cmd"
repo = "TNI-SITE-DOWN"

url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs"
headers = {
    "Authorization": f"token {pat}",
    "Accept": "application/vnd.github.v3+json"
}

resp = requests.get(url, headers=headers)
if resp.status_code == 200:
    runs = resp.json().get("workflow_runs", [])
    print(f"Total runs found: {len(runs)}")
    for run in runs[:5]:
        print(f"Run ID: {run['id']} | Name: {run['name']} | Event: {run['event']} | Status: {run['status']} | Created: {run['created_at']}")
else:
    print(f"Failed to fetch runs: {resp.status_code} - {resp.text}")
