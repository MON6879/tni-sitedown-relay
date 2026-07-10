import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&sheet=BOD+assign"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None)
    print("CSV shape:", df.shape)
    print("\nCSV columns (Row 0):")
    for idx, val in enumerate(df.iloc[0]):
        print(f"  Col index {idx}: {val}")
    
    print("\nRow 57 (representing row 58 in sheets) content:")
    if len(df) > 57:
        for idx, val in enumerate(df.iloc[57]):
            print(f"  Col index {idx}: {val}")
except Exception as e:
    print("Error:", e)
