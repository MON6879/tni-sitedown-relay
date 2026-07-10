import requests
import pandas as pd
import io

TEAM_SHEET_URL = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=133591305"
try:
    resp = requests.get(TEAM_SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
    
    print("Team Sheet Rows (first 60):")
    for idx in range(3, min(len(df), 60)):
        row = df.iloc[idx]
        team = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ""
        name = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ""
        username = str(row.iloc[2]).strip() if not pd.isna(row.iloc[2]) else ""
        tg_id = str(row.iloc[4]).strip() if len(row) > 4 and not pd.isna(row.iloc[4]) else ""
        if tg_id.endswith(".0"): tg_id = tg_id[:-2]
        
        print(f"Row {idx+1}: Team={team}, Name={name}, Username={username}, TG_ID={tg_id}")
            
except Exception as e:
    print("Error:", e)
