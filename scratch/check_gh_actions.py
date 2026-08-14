import urllib.request
import json

url = "https://api.github.com/repos/MON6879/tni-sitedown-relay/actions/runs?per_page=5"
req = urllib.request.Request(url, headers={"User-Agent": "Python/3.11"})

try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode('utf-8'))
    runs = data.get("workflow_runs", [])
    print(f"Total Workflow Runs Found: {len(runs)}")
    for r in runs[:5]:
        print(f"Run ID: {r['id']} | Name: {r['name']} | Event: {r['event']} | Status: {r['status']} | Conclusion: {r['conclusion']} | Created: {r['created_at']}")
except Exception as e:
    print(f"Error fetching GitHub Actions status: {e}")
