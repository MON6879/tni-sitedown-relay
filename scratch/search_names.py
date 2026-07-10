import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=csv&gid=133591305"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None)
    
    print("=== TASK REMAIN ROWS ===")
    for idx, row in df.iterrows():
        row_str = " | ".join(str(val) for val in row)
        # Search for Aung or Win
        if any(x in row_str.lower() for x in ["win", "aung", "htet", "hter"]):
            print(f"Row {idx+1}: {row_str}")
except Exception as e:
    print("Error:", e)
