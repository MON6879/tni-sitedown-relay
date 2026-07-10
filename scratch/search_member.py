import pandas as pd
import requests
import io

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=csv&gid=133591305"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None)
    print("Loaded employee sheet. Total rows:", len(df))
    
    # Let's search for "Win Hter Aung" (case-insensitive) in all cells
    found = False
    for idx, row in df.iterrows():
        row_str = " | ".join(str(val) for val in row)
        if "Win Hter Aung" in row_str or "Hter Aung" in row_str:
            print(f"Row {idx+1}: {row_str}")
            found = True
            
    if not found:
        print("Win Hter Aung NOT found in the employee sheet.")
except Exception as e:
    print("Error:", e)
