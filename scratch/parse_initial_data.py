import requests
import re
import json

url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/edit"
r = requests.get(url, timeout=10)
content = r.text

match = re.search(r'_docs_flag_initialData\s*=\s*(.*?);', content)
if match:
    data_str = match.group(1)
    print("Found _docs_flag_initialData, length:", len(data_str))
    # Write to a file to examine
    with open("scratch/initialData.txt", "w", encoding="utf-8") as f:
        f.write(data_str[:20000]) # first 20k chars
    print("Saved snippet to scratch/initialData.txt")
    # Let's search inside data_str for sheet/title names
    # Google Sheets json contains "title":"Sheet Name"
    titles = re.findall(r'\"title\":\"([^\"]+)\"', data_str)
    print("Found titles:", list(set(titles)))
else:
    print("_docs_flag_initialData not found")
