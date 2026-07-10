import pandas as pd
import requests
import io

DAILY_REPORT_CSV = "https://docs.google.com/spreadsheets/d/1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y/gviz/tq?tqx=out:csv&sheet=Daily+report+and+Bussiness"
TEAM_SHEET_URL = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=csv&gid=133591305"

def check():
    # 1. Download daily reports
    print("Downloading daily reports...")
    resp = requests.get(DAILY_REPORT_CSV, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), dtype=str)
    print(f"Loaded {len(df)} daily report rows.")
    
    # 2. Search for "Win Hter Aung"
    matching_reports = []
    for idx, row in df.iterrows():
        # Join values to search
        row_str = " | ".join(str(val) for val in row.dropna())
        if "Win Hter Aung" in row_str:
            matching_reports.append((idx + 2, row))  # Google Sheet row number is index + 2
            
    print(f"\nFound {len(matching_reports)} rows matching 'Win Hter Aung' in Daily report sheet:")
    for rnum, row in matching_reports:
        print(f"\n[Row {rnum}]")
        for col_idx, (col_name, val) in enumerate(zip(df.columns, row)):
            print(f"  Col {chr(65+col_idx)} ({col_name}): {repr(val)}")

    # If we found any matching rows, let's trace their Telegram IDs
    if not matching_reports:
        return
        
    tg_ids = [str(row.iloc[17]).strip() for _, row in matching_reports if not pd.isna(row.iloc[17])]
    print(f"\nTelegram IDs found in matching rows: {tg_ids}")
    
    # 3. Download member mapping
    print("\nDownloading team member mapping...")
    resp_map = requests.get(TEAM_SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp_map.raise_for_status()
    df_map = pd.read_csv(io.StringIO(resp_map.text), header=None, dtype=str)
    
    TEAM_PATTERNS = {
        "TEAM01": "T1", "TEAM 1": "T1", "TEAM1": "T1",
        "TEAM02": "T2", "TEAM 2": "T2", "TEAM2": "T2",
        "TEAM05": "T2", "TEAM 5": "T2", "TEAM5": "T2",
        "TEAM03": "T3", "TEAM 3": "T3", "TEAM3": "T3",
        "TEAM04": "T4", "TEAM 4": "T4", "TEAM4": "T4",
    }
    
    mapping = {}
    for idx in range(3, min(len(df_map), 59)):
        row = df_map.iloc[idx]
        col_a = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ""
        col_e = str(row.iloc[4]).strip() if not pd.isna(row.iloc[4]) else ""
        if not col_a or not col_e:
            continue
        cid = col_e.replace(".0", "") if col_e.endswith(".0") else col_e
        team_str = col_a.upper()
        for pattern, gk in TEAM_PATTERNS.items():
            if pattern in team_str:
                mapping[cid] = (gk, str(row.iloc[1]).strip(), col_a)
                break

    print("\nTrace results for Telegram IDs:")
    for tid in tg_ids:
        cid = tid.replace(".0", "") if tid.endswith(".0") else tid
        map_info = mapping.get(cid)
        if map_info:
            print(f"  ID {cid} matches: Group={map_info[0]} | Name in mapping={map_info[1]} | Raw Team={map_info[2]}")
        else:
            print(f"  ID {cid} has NO mapping entry in GID 133591305!")

if __name__ == "__main__":
    check()
