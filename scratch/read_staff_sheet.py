import requests
import io
import pandas as pd

SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
STAFF_SHEET_URL = (
    f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
    "/export?format=csv&gid=1684930643"
)

try:
    resp = requests.get(STAFF_SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
    
    print("Headers:", list(df.iloc[0]))
    print("\n--- Leaders in Staff sheet ---")
    for idx_r, row in df.iterrows():
        if idx_r == 0:
            continue
        try:
            col_a = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ""
            col_f = str(row.iloc[5]).strip() if not pd.isna(row.iloc[5]) else ""
            col_l = str(row.iloc[11]).strip() if not pd.isna(row.iloc[11]) else ""
            col_m = str(row.iloc[12]).strip() if not pd.isna(row.iloc[12]) else ""
            col_n = str(row.iloc[13]).strip() if not pd.isna(row.iloc[13]) else ""
            
            if "leader" in col_l.lower():
                print(f"Row {idx_r+1}: Name='{col_f}' | Position='{col_l}' | Team='{col_m}' | Telegram ID='{col_a}' | Col N='{col_n}'")
        except Exception as e:
            pass
except Exception as e:
    print("Error:", e)
