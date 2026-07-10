import pandas as pd
import requests
import io
from datetime import datetime, timedelta, timezone

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=0"
resp = requests.get(url)
df = pd.read_csv(io.StringIO(resp.text), header=None)

# Skip row 0 if it contains headers/meta
# Row 0: ['  Alarm need repair: Exported Time: 30/06/2026 14:53:35 Task WO', ...]
# Row 1 is the first actual data row
data_rows = df.iloc[1:].copy()

print("Data rows count:", len(data_rows))

# Parse columns:
# Col 1: Date (dd/mm/yyyy or dd/mm/yyyy hh:mm)
# Col 3: Name
# Col 8 (I): Completed (if not empty/nan)
# Col 10 (K): Confirm (if not empty/nan, it is confirmed. If empty/nan, it is unconfirmed)

results = {}

for idx, row in data_rows.iterrows():
    date_str = str(row[1]).strip()
    name = str(row[3]).strip()
    completed_val = str(row[8]).strip() if not pd.isna(row[8]) else ""
    confirm_val = str(row[10]).strip() if not pd.isna(row[10]) else ""
    
    if name == "nan" or not name:
        continue
        
    print(f"Row {idx}: Name={name}, Date={date_str}, Completed={completed_val}, Confirm={confirm_val}")
