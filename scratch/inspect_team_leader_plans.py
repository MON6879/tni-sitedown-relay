import requests
import pandas as pd
import io

url = "https://docs.google.com/spreadsheets/d/1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y/gviz/tq?sheet=Team+leader+assign+Plan&tqx=out:csv"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), dtype=str)
    print("Columns:", list(df.columns))
    
    # Filter for entries on 09/07/2026
    df_filtered = df[df['Date'].str.contains('09/07/2026', na=False, regex=False)]
    print(f"\nEntries for 09/07/2026 (Count: {len(df_filtered)}):")
    print(df_filtered[['REF', 'Date', 'Team', 'Daily Plan']].to_string(index=False))
except Exception as e:
    print("Error:", e)
