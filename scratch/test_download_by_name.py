import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&sheet=BOD+assign"
resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
df = pd.read_csv(io.StringIO(resp.text))

print("Downloaded shape:", df.shape)
print("\nColumns:")
for i, col in enumerate(df.columns):
    print(f"Col {i} ({chr(65+i)}): {col}")

print("\nFirst 5 rows:")
print(df.head(5).to_string())
