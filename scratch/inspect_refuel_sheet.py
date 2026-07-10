import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/gviz/tq?tqx=out:csv&sheet=Refuel"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str)
    print("Columns count:", len(df.columns))
    print("Rows count:", len(df))
    print("First 15 rows of column G (index 6):")
    if len(df.columns) > 6:
        print(df.iloc[:, 6].head(15).to_string())
    else:
        print("Column G not found!")
except Exception as e:
    print("Error:", e)
