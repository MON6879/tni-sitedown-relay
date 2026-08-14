import urllib.request
import re

url = 'https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=csv&gid=1840482617'
content = urllib.request.urlopen(url).read().decode('utf-8')

m = re.search(r'Export\s*time:\s*([^\r\n,"]+)', content, re.IGNORECASE)
if m:
    print('EXACT MATCH:', repr(m.group(1).strip()))
else:
    print('NO MATCH')
