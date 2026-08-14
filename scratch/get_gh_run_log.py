import urllib.request
import json

url = "https://api.github.com/repos/MON6879/tni-sitedown-relay/actions/runs/31769758307/jobs"
req = urllib.request.Request(url, headers={"User-Agent": "Python/3.11"})

try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode('utf-8'))
    jobs = data.get("jobs", [])
    print(f"Total Jobs: {len(jobs)}")
    for j in jobs:
        print(f"Job Name: {j['name']} | Status: {j['status']} | Conclusion: {j['conclusion']}")
        for step in j.get("steps", []):
            print(f"  Step: {step['name']} | Conclusion: {step.get('conclusion')}")
except Exception as e:
    print(f"Error: {e}")
