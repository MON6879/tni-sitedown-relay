import pandas as pd
import requests
import io
import re

url = "https://docs.google.com/spreadsheets/d/19RBlwehMC6BLoueaTEzsJHMx4puB0CTE5i5x79-uI6c/gviz/tq?tqx=out:csv&sheet=Auto_Copy_Config"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    
    def extract_id(link):
        if pd.isna(link):
            return None
        match = re.search(r'/d/([a-zA-Z0-9-_]+)', str(link))
        return match.group(1) if match else str(link)

    src_links = df.iloc[:, 0].dropna().tolist()
    src_ids = [extract_id(l) for l in src_links]
    unique_ids = set(src_ids)
    
    print("Total rows:", len(df))
    print("Total source links:", len(src_links))
    print("Unique source spreadsheet IDs:", len(unique_ids))
    print("Unique IDs list:")
    for uid in unique_ids:
        print("  -", uid)
except Exception as e:
    print("Error:", e)
