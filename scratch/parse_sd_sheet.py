import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?tqx=out:csv&gid=0"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str)
    
    # AV = 47, AW = 48, AX = 49, AY = 50, AZ = 51, BA = 52, BB = 53 (0-based indices)
    cols = [47, 48, 49, 50, 51, 52, 53]
    for r in range(4, 16):
        row_str = f"Row {r+1}: "
        for c in cols:
            val = df.iloc[r, c] if c < len(df.columns) else "N/A"
            # Get first 30 chars
            val_trunc = str(val)[:30] if pd.notna(val) else "Empty"
            col_letter = chr(65 + c) if c < 26 else chr(65 + (c // 26) - 1) + chr(65 + (c % 26))
            row_str += f"[{col_letter}: {val_trunc}] "
        print(row_str)
except Exception as e:
    print("Error:", e)
