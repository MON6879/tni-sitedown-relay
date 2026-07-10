import requests
import pandas as pd
import io

TEAM_SHEET_URL = "https://docs.google.com/spreadsheets/d/1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y/gviz/tq?tqx=out:csv&gid=133591305"
try:
    resp = requests.get(TEAM_SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
    
    print("Columns count:", len(df.columns))
    for idx in range(0, min(len(df), 20)):
        row = list(df.iloc[idx])
        print(f"Row {idx+1}: {row}")
except Exception as e:
    print("Error:", e)
