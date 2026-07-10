import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y/gviz/tq?tqx=out:csv&sheet=Daily+report+and+Bussiness"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    print("Columns:")
    for idx, col in enumerate(df.columns):
        print(f"  {idx}: {col}")
    print("\nFirst row sample:")
    print(df.head(1).to_string())
except Exception as e:
    print("Error:", e)
