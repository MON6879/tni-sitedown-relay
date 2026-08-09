import requests, re
url = 'https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/edit'
html = requests.get(url).text
matches = re.findall(r'sheetId["\']?\s*:\s*(\d+).*?title["\']?\s*:\s*["\']([^"\']+)["\']', html, re.DOTALL)
for m in set(matches):
    print(m)
