import pandas as pd
import requests
import io
import re

def simulate():
    # 1. Fetch sheets
    url_sd = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?tqx=out:csv&gid=0"
    url_tc = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?sheet=TeamConfig&tqx=out:csv"
    
    resp_sd = requests.get(url_sd, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp_tc = requests.get(url_tc, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    
    df_sd = pd.read_csv(io.StringIO(resp_sd.text), header=None, dtype=str)
    df_tc = pd.read_csv(io.StringIO(resp_tc.text), dtype=str)
    
    # 2. Replicate loadTeamConfig
    config = {
        "groups": {},
        "colors": {},
        "awazCol": {},
        "teamLabels": {},
        "subTeams": {}
    }
    
    for idx, row in df_tc.iterrows():
        code = str(row.iloc[0]).strip()
        parent = str(row.iloc[1]).strip()
        chat_id = str(row.iloc[2]).strip()
        label = str(row.iloc[3]).strip()
        emoji = str(row.iloc[4]).strip()
        col_idx = str(row.iloc[5]).strip()
        
        code_upper = code.upper()
        parent_upper = parent.upper()
        
        if code_upper == parent_upper:
            if chat_id and chat_id != "nan":
                config["groups"][parent_upper] = chat_id
            if emoji and emoji != "nan":
                config["colors"][parent_upper] = emoji
            if col_idx and col_idx != "nan" and col_idx != "":
                config["awazCol"][parent_upper] = int(col_idx)
            if label and label != "nan":
                config["teamLabels"][parent_upper] = label
        else:
            config["subTeams"][code_upper] = parent_upper

    print("Loaded Config:")
    print("groups:", config["groups"])
    print("awazCol:", config["awazCol"])
    print("teamLabels:", config["teamLabels"])

    # 3. Replicate parseAW7Timestamp
    # Row 7 is index 6 (0-based)
    aw7_val = df_sd.iloc[6, 48] # AW7 (row 7, col AW = 48)
    print("\nAW7 raw value:", aw7_val)
    m = re.search(r'Site down:\s*(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})', aw7_val, re.IGNORECASE)
    ts = m.group(1).strip() if m else None
    print("Parsed TS:", ts)
    
    # 4. Replicate readAwAz
    max_col_idx = 3
    for team, col_idx in config["awazCol"].items():
        if col_idx > max_col_idx:
            max_col_idx = col_idx
    num_cols = max_col_idx + 1
    print(f"num_cols: {num_cols}")
    
    # Read row 7 to 15 (9 rows), cols AW to AZ
    awaz_data = []
    for r in range(6, 15):
        row_vals = []
        for c in range(48, 48 + num_cols):
            val = df_sd.iloc[r, c] if c < len(df_sd.columns) else ""
            row_vals.append("" if pd.isna(val) else str(val).strip())
        awaz_data.append(row_vals)
        
    print("\nAwAz data (9 rows):")
    for r_idx, row in enumerate(awaz_data):
        print(f"Row {r_idx + 7}: {row}")

    # 5. Replicate buildAwAzTeamMessage for each team
    awaz_labels = [
        {"emoji": "⚡", "name": "Site down"},
        {"emoji": "🔴", "name": "Cell down"},
        {"emoji": "⚙️", "name": "DG Abnormal"},
        {"emoji": "⏱️", "name": "DG Run>16H"},
        {"emoji": "🔗", "name": "Link down"},
    ]
    
    teams = [t for t in config["groups"].keys() if t != "CONTROL"]
    print("\nSimulated Team Messages:")
    for team in teams:
        chat_id = config["groups"][team]
        col_idx = config["awazCol"].get(team)
        if col_idx is None:
            print(f"Skipping {team} — no col_idx")
            continue
            
        label = config["teamLabels"].get(team, team)
        lines = []
        lines.append(f"📊 <b>SUMMARY — {label}</b>")
        lines.append(f"📅 {ts}")
        lines.append("━" * 26)
        
        has_data = False
        for r in range(len(awaz_data)):
            txt = awaz_data[r][col_idx]
            if not txt or txt == "0":
                continue
                
            clean = txt.replace("*", "").replace("_", "").replace("`", "")
            if r < len(awaz_labels):
                lines.append(f"{awaz_labels[r]['emoji']} <b>{awaz_labels[r]['name']}:</b> {clean}")
            else:
                label_match = re.match(r'^([^:]+):', txt)
                cell_label = label_match.group(1).replace("*", "").replace("_", "").replace("`", "").strip() if label_match else f"Row {r+1}"
                lines.append(f"📌 <b>{cell_label}:</b> {clean}")
            has_data = True
            
        if not has_data:
            lines.append("✅ Không có sự cố")
            
        print(f"\n--- {team} (Col {col_idx}) ---")
        print("\n".join(lines))

if __name__ == "__main__":
    simulate()
