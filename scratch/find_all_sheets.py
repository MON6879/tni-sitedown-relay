import requests
import re
import json

url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/edit"
r = requests.get(url, timeout=10)
content = r.text

print("HTML length:", len(content))

# Look for standard Google Sheets JSON structure in script tag: bootstrapData
# Which contains "sheet" info in its workbook model
# A simple regex for "sheetId":XXXX,"title":"XXXX"
matches = re.findall(r'\"sheetId\":\s*(\d+).*?\"title\":\"([^\"]+)\"', content)
print("Regex matches count:", len(matches))
for m in matches[:10]:
    print(f"Sheet ID: {m[0]} | Title: {m[1]}")

# Try another search for "gid"
gids = re.findall(r'#gid=(\d+)', content)
print("Found #gid= matches:", set(gids))

# Search for sheetName or sheetId in all script tags
script_contents = re.findall(r'<script\b[^>]*>(.*?)</script>', content, re.DOTALL)
print("Found script tags:", len(script_contents))
for i, sc in enumerate(script_contents):
    if 'sheetId' in sc or 'sheetName' in sc or 'title' in sc:
        print(f"Script tag {i} contains keywords, length: {len(sc)}")
        # Print a snippet
        snippet = sc[:300].replace('\n', ' ')
        print("  Snippet:", snippet)
