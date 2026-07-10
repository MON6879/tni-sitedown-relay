import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=0"
resp = requests.get(url)
df = pd.read_csv(io.StringIO(resp.text), header=None)

with open("scratch/bod_assign_raw.txt", "w", encoding="utf-8") as f:
    f.write("Raw rows count: {}\n\n".format(len(df)))
    for idx, row in df.iterrows():
        f.write(f"Row {idx}:\n")
        for col_idx, val in enumerate(row):
            f.write(f"  Col {col_idx} ({chr(65+col_idx)}): {val}\n")
        f.write("-" * 40 + "\n")
