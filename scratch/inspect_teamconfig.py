import pandas as pd
import requests
import io
import json

# Get sheet info
url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?tqx=out:json"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    # Parse jsonp
    text = resp.text
    start = text.find("{")
    end = text.rfind("}") + 1
    data = json.loads(text[start:end])
    
    # Print sheet names
    print("Sheets in spreadsheet:")
    # We can get GID by trying to download TeamConfig.
    # Actually, we can fetch the sheet by name:
    # URL: https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?sheet=TeamConfig&tqx=out:csv
    url_tc = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?sheet=TeamConfig&tqx=out:csv"
    resp_tc = requests.get(url_tc, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp_tc.raise_for_status()
    print("TeamConfig content:")
    print(resp_tc.text)
except Exception as e:
    print("Error:", e)
