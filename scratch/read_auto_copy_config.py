import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/19RBlwehMC6BLoueaTEzsJHMx4puB0CTE5i5x79-uI6c/gviz/tq?tqx=out:csv&sheet=Auto_Copy_Config"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    output_path = "scratch/config_output.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(df.to_string())
    print("Successfully wrote config to", output_path)
except Exception as e:
    print("Error:", e)

