import urllib.request
import json

# Try to download the log from the failed step for run 31769758307
# GitHub API: GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs
# This requires auth, so try the jobs endpoint for annotations
url = "https://api.github.com/repos/MON6879/tni-sitedown-relay/actions/runs/31769758307/attempts/1/logs"
req = urllib.request.Request(url, headers={"User-Agent": "Python/3.11", "Accept": "application/vnd.github.v3+json"})

try:
    resp = urllib.request.urlopen(req)
    print(f"Status: {resp.status}")
    print(resp.read().decode('utf-8')[:500])
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    # Try annotations instead
    url2 = f"https://api.github.com/repos/MON6879/tni-sitedown-relay/check-runs/94673065762/annotations"
    req2 = urllib.request.Request(url2, headers={"User-Agent": "Python/3.11"})
    try:
        resp2 = urllib.request.urlopen(req2)
        data2 = json.loads(resp2.read().decode('utf-8'))
        print(f"\nAnnotations ({len(data2)} total):")
        for ann in data2:
            print(f"  Level: {ann.get('annotation_level')} | Message: {ann.get('message', '')[:200]}")
    except Exception as e2:
        print(f"Annotations error: {e2}")
