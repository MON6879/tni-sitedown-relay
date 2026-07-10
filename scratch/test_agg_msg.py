import pandas as pd
import requests
import io
from datetime import datetime, timedelta, timezone

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=0"
resp = requests.get(url)
df = pd.read_csv(io.StringIO(resp.text), header=None)

# Skip row 0
data_rows = df.iloc[1:].copy()

# Date reference: let's assume today is 2026-06-30
# In production, we'll use current date in Myanmar timezone
tz_mm = timezone(timedelta(hours=6, minutes=30))
today = datetime(2026, 6, 30, tzinfo=tz_mm) # For test, let's use 2026-06-30

d0 = today.date()
d1 = (today - timedelta(days=1)).date()
d2 = (today - timedelta(days=2)).date()
d6_limit = (today - timedelta(days=6)).date()

def parse_date(val):
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    # Try different formats
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(val_str.split()[0], "%d/%m/%Y").date()
        except Exception:
            try:
                return datetime.strptime(val_str, fmt).date()
            except Exception:
                pass
    return None

stats = {}

for idx, row in data_rows.iterrows():
    date_str = row[1]
    name = row[3]
    completed_val = row[8]
    confirm_val = row[10]
    
    if pd.isna(name) or not str(name).strip():
        continue
    name = str(name).strip()
    
    # Parse date
    row_date = parse_date(date_str)
    if not row_date:
        continue
        
    is_completed = not pd.isna(completed_val) and str(completed_val).strip() != ""
    is_confirmed = not pd.isna(confirm_val) and str(confirm_val).strip() != ""
    
    if name not in stats:
        stats[name] = {
            "d0": 0, "d1": 0, "d2": 0,
            "d7": 0, "month": 0, "unconfirmed": 0
        }
        
    if is_completed:
        # Check date intervals
        if row_date == d0:
            stats[name]["d0"] += 1
        elif row_date == d1:
            stats[name]["d1"] += 1
        elif row_date == d2:
            stats[name]["d2"] += 1
            
        if row_date >= d6_limit:
            stats[name]["d7"] += 1
            
        if row_date.year == today.year and row_date.month == today.month:
            stats[name]["month"] += 1
            
        if not is_confirmed:
            stats[name]["unconfirmed"] += 1

print("Aggregation Results:")
for name, s in stats.items():
    print(f"{name}: 3Day:{s['d2']}/{s['d1']}/{s['d0']} | 7Day:{s['d7']} | Month:{s['month']} | Unconfirmed:{s['unconfirmed']}")
