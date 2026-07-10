import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=0"
resp = requests.get(url)
data = resp.text

df = pd.read_csv(io.StringIO(data), header=None)

with open("scratch/bod_assign_inspect.txt", "w", encoding="utf-8") as f:
    f.write(f"Total rows: {len(df)}, columns: {df.shape[1]}\n\n")
    for r_idx in range(min(50, len(df))):
        f.write(f"Row {r_idx}: ")
        row_vals = [str(x) for x in df.iloc[r_idx].tolist()]
        f.write(" | ".join(row_vals))
        f.write("\n" + "="*80 + "\n")
