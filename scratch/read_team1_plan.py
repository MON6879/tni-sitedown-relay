import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/14aPH4Y1l8B6ZeumJJ58suWfV1uShQotM4c5haK7SoVU/export?format=csv&gid=110921238"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    print("Loaded Team 1 Find sheet. Rows:", len(df))
    # Print the first 5 rows
    print(df.head(5).to_string())
except Exception as e:
    print("Error:", e)
