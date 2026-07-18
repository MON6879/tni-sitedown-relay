import requests
import io
import pandas as pd

SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
GID = "1674368572"
url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid={GID}"

try:
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text), header=None, dtype=str, on_bad_lines="skip")
    print(f"Successfully fetched sheet. Rows: {len(df)}")
    for idx, row in list(df.iterrows())[:20]:
        print(f"Row {idx}: {list(row)}")
except Exception as e:
    print(f"Error: {e}")
