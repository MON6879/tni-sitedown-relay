import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=0"
resp = requests.get(url)
data = resp.text

print("Downloaded length:", len(data))

df = pd.read_csv(io.StringIO(data), header=None)
print("DF shape:", df.shape)
print("First row values:")
print(df.iloc[0].tolist())

print("\nValue counts of names (Col 3):")
print(df[3].value_counts(dropna=False))

print("\nValue counts of dates (Col 1):")
print(df[1].value_counts(dropna=False))
