import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=0"
resp = requests.get(url)
df = pd.read_csv(io.StringIO(resp.text))

print("Columns:")
for i, col in enumerate(df.columns):
    print(f"Col {i} ({chr(65+i)}): {col}")

print("\nFirst 10 rows:")
print(df.head(10).to_string())
