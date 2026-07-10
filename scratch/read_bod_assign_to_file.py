import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=0"
resp = requests.get(url)
df = pd.read_csv(io.StringIO(resp.text))

with open("scratch/bod_assign_info.txt", "w", encoding="utf-8") as f:
    f.write("Columns:\n")
    for i, col in enumerate(df.columns):
        f.write(f"Col {i} ({chr(65+i)}): {col}\n")
    
    f.write("\nShape: {}\n".format(df.shape))
    f.write("\nFirst 20 rows (only non-null entries/sample data):\n")
    f.write(df.head(20).to_string())
