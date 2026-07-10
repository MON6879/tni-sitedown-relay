import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1EmECb3aPXMRxSyUzhV6wKU2oDq_32Ga-lwpwmkcHdh0/gviz/tq?tqx=out:csv&sheet=Input Close WO DG paste 123"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    print("Columns:", df.columns.tolist())
    print("First 5 rows:")
    print(df.head(5).to_string())
except Exception as e:
    print("Error:", e)
