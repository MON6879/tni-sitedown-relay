import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1EmECb3aPXMRxSyUzhV6wKU2oDq_32Ga-lwpwmkcHdh0/gviz/tq?tqx=out:csv&sheet=Input Close WO DG paste 123"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    col0 = df.columns[0]
    print("Column 0 Name:", col0)
    print("Value counts of Column 0:")
    print(df[col0].value_counts(dropna=False))
    print("\nRows where Column 0 is 'New':")
    print(df[df[col0] == 'New'].head(5).to_string())
except Exception as e:
    print("Error:", e)
