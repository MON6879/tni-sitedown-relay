import requests
import csv

url = "https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/export?format=csv&gid=201295323"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    reader = csv.reader(resp.text.splitlines())
    for r_idx, row in enumerate(reader):
        if not any(row):  # Skip completely empty rows
            continue
        print(f"Row {r_idx + 1}: length={len(row)}")
        for c_idx, val in enumerate(row):
            val_clean = val.replace('\n', ' ')
            if len(val_clean) > 50:
                val_clean = val_clean[:47] + "..."
            print(f"  Col {chr(65+c_idx)} ({c_idx+1}): '{val_clean}'")
except Exception as e:
    print("Error:", e)
