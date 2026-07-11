import requests
import re

url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/edit?gid=0"
r = requests.get(url, timeout=10)
# Look for sheet names in script tags
content = r.text
matches = re.findall(r'\"name\":\"([^\"]+)\",\"sheetId\":(\d+)', content)
if not matches:
    matches = re.findall(r'\"name\":\"([^\"]+)\",\"id\":(\d+)', content)

for m in matches:
    print(f"Sheet ID: {m[1]} | Name: {m[0]}")
