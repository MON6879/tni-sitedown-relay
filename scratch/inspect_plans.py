import requests
import pandas as pd
import io

url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?sheet=DailyPlan&tqx=out:csv"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), dtype=str)
    print("Columns:", list(df.columns))
    print("\nRecent 15 entries:")
    print(df.tail(15).to_string(index=False))
except Exception as e:
    print("Error:", e)
