import requests
import json
import re

url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/edit"
r = requests.get(url, timeout=10)
content = r.text

# Try to find sheet metadata in the page source
# Google Sheets stores metadata in a script tag containing bootstrapData
# We can search for the list of sheets
match = re.search(r'bootstrapData\s*=\s*({.+?});', content)
if match:
    try:
        data = json.loads(match.group(1))
        # Let's inspect the keys to find sheets list
        print("Keys in bootstrapData:", list(data.keys()))
        if "changes" in data:
            print("Changes keys:", list(data["changes"].keys()))
    except Exception as e:
        print("JSON parse error:", e)
else:
    print("bootstrapData not found")

# Alternate regex for "sheetId" or "gid"
sheets = re.findall(r'\"name\":\"([^\"]+)\",\"sheetId\":(\d+)', content)
if not sheets:
    sheets = re.findall(r'\"name\":\"([^\"]+)\",\"id\":(\d+)', content)
if not sheets:
    # Try finding in the whole text
    for line in content.split('\n'):
        if 'sheetId' in line or 'gid' in line:
            if 'name' in line:
                print("Line:", line[:200])
                break

print(f"Found {len(sheets)} sheets:")
for s in sheets[:20]:
    print(f"  Name: {s[0]} | GID: {s[1]}")
