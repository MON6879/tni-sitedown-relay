import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1s53UHIDF-T9P4EuNB8XoE9yTpoNmDyrQaEe_VJP6f9o/gviz/tq?tqx=out:csv&sheet=2.+See+alalysis"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    print("Columns:", df.columns.tolist())
    print("First 15 rows of column A:")
    print(df.iloc[:, 0].head(15))
except Exception as e:
    print("Error:", e)
