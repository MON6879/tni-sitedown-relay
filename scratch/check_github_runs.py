import requests

url = "https://api.github.com/repos/phonghdpxd-cmd/tni-bot/actions/runs"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    runs = data.get("workflow_runs", [])
    print(f"Total runs fetched: {len(runs)}")
    
    # Print detail of the 10 most recent runs
    for run in runs[:10]:
        print(f"\nRun ID: {run['id']}")
        print(f"  Name: {run['name']}")
        print(f"  Event: {run['event']}")
        print(f"  Status: {run['status']}")
        print(f"  Conclusion: {run['conclusion']}")
        print(f"  Created At: {run['created_at']}")
        print(f"  URL: {run['html_url']}")
except Exception as e:
    print("Error:", e)
