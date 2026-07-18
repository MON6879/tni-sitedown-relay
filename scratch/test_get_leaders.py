import requests
import io
import pandas as pd

TEAM_SHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
TEAM_SHEET_URL = (
    f"https://docs.google.com/spreadsheets/d/{TEAM_SHEET_ID}"
    "/export?format=csv&gid=133591305"
)

def get_team_leaders():
    leaders = {}
    try:
        resp = requests.get(TEAM_SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
        
        for idx in range(3, min(len(df), 59)):
            row = df.iloc[idx]
            team = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ""
            username = str(row.iloc[2]).strip() if not pd.isna(row.iloc[2]) else ""
            tg_id = str(row.iloc[4]).strip() if len(row) > 4 and not pd.isna(row.iloc[4]) else ""
            if tg_id.endswith(".0"): tg_id = tg_id[:-2]
            
            # Print row for debugging
            if "leader" in username.lower() or "team" in team.lower():
                print(f"Row {idx+1}: Team='{team}' | Role/Username='{username}' | Telegram ID='{tg_id}'")
            
            if "leader" in username.lower():
                tk = team.upper()
                if "TEAM01" in tk or "TEAM1" in tk: tk = "T1"
                elif "TEAM02" in tk or "TEAM2" in tk or "TEAM05" in tk or "TEAM5" in tk: tk = "T2"
                elif "TEAM03" in tk or "TEAM3" in tk: tk = "T3"
                elif "TEAM04" in tk or "TEAM4" in tk: tk = "T4"
                else: tk = ""
                
                if tk:
                    leaders[tk] = tg_id
    except Exception as e:
        print("Error:", e)
    return leaders

leaders = get_team_leaders()
print("\nFinal leaders dict:", leaders)
