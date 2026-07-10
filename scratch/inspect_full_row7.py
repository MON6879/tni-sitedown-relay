import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?tqx=out:csv&gid=0"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str)
    
    cols = [48, 49, 50, 51] # AW, AX, AY, AZ
    for c in cols:
        col_letter = chr(65 + c) if c < 26 else chr(65 + (c // 26) - 1) + chr(65 + (c % 26))
        print(f"Col {col_letter}: '{df.iloc[6, c]}'")
except Exception as e:
    print("Error:", e)
