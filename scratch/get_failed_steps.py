import urllib.request
import json

# Get detailed log for the failed run 31769758307
# First, get the jobs to find job ID
url = "https://api.github.com/repos/MON6879/tni-sitedown-relay/actions/runs/31769758307/jobs"
req = urllib.request.Request(url, headers={"User-Agent": "Python/3.11"})

resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode('utf-8'))
jobs = data.get("jobs", [])

for job in jobs:
    print(f"Job ID: {job['id']} | Name: {job['name']} | Conclusion: {job['conclusion']}")
    for step in job.get("steps", []):
        print(f"  Step: {step['name']} | Conclusion: {step.get('conclusion')} | Started: {step.get('started_at')} | Completed: {step.get('completed_at')}")
