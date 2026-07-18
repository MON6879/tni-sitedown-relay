import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/19RBlwehMC6BLoueaTEzsJHMx4puB0CTE5i5x79-uI6c/gviz/tq?tqx=out:csv&sheet=Auto_Copy_Config"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    print(f"Total rows: {len(df)}")
    for idx, row in df.iterrows():
        print(f"\n--- Row {idx} (Excel Row {idx + 2}) ---")
        for col_name, val in row.items():
            if pd.notna(val) and str(val).strip() != "":
                print(f"  {col_name}: {val}")
except Exception as e:
    print("Error:", e)
