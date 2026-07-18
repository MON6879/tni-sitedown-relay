import requests
import io
import pandas as pd

TEAM_SHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
TEAM_SHEET_URL = (
    f"https://docs.google.com/spreadsheets/d/{TEAM_SHEET_ID}"
    "/export?format=csv&gid=133591305"
)

try:
    resp = requests.get(TEAM_SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
    
    # Print headers (first 3 rows)
    for i in range(3):
        print(f"Header {i+1}: {list(df.iloc[i])}")
        
    print("\n--- Rows 4 to 59 ---")
    for idx in range(3, min(len(df), 59)):
        row = df.iloc[idx]
        print(f"Row {idx+1}: {list(row)}")
except Exception as e:
    print("Error:", e)
