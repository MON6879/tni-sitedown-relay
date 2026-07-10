import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=csv&gid=1482565085"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    print("Columns in BOD assign sheet:")
    for idx, col in enumerate(df.columns):
        print(f"  Col {chr(65+idx)} (index {idx}): {col}")
except Exception as e:
    print("Error:", e)
