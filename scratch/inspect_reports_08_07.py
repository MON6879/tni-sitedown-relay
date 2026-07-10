import requests
import pandas as pd
import io

url = "https://docs.google.com/spreadsheets/d/1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y/gviz/tq?sheet=Daily+report+and+Bussiness&tqx=out:csv"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), dtype=str)
    
    # Filter for Date 8/7/2026 or 08/07/2026
    df_filtered = df[df['Daily report'].str.contains('8/7/2026|08/07/2026', na=False, regex=True)]
    print(f"Total entries for 08/07/2026: {len(df_filtered)}")
    
    cols = ['Tên nhân viên', 'Daily report', 'Full Name', 'Detail WO', 'Detail task', 'Name Site rescue', 'Name Cell rescue', 'Resuce Cable', 'Name and detai Site repair alarm', 'Telegram ID']
    # Check which of these columns exist in df
    available_cols = [c for c in cols if c in df.columns]
    print(df_filtered[available_cols].to_string(index=False))
except Exception as e:
    print("Error:", e)
