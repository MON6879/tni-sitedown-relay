import pandas as pd
from datetime import datetime, timedelta, timezone

# Load from the local sheet.xlsx we downloaded earlier
df = pd.read_excel("scratch/sheet.xlsx", sheet_name="BOD assign")

print("Rows:", len(df))

# Columns mapping:
# Col 0 (A): Assign Admin -> role/department
# Col 7 (H): Dep update Date complete -> Completed Date
# Col 9 (J): Manager Confirm -> Confirmation

# Clean columns
df.columns = [str(c).strip() for c in df.columns]

role_col = df.columns[0]
completed_date_col = df.columns[7]
confirm_col = df.columns[9]

print(f"Role col: '{role_col}'")
print(f"Completed Date col: '{completed_date_col}'")
print(f"Confirm col: '{confirm_col}'")

# Date reference: let's assume today is 2026-06-30
tz_mm = timezone(timedelta(hours=6, minutes=30))
today = datetime(2026, 6, 30, tzinfo=tz_mm) # June 30th, 2026

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
    # If it is a timestamp object from pandas excel read
    if isinstance(val, datetime):
        return val.date()
    # Try parsing
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(val_str, fmt).date()
        except Exception:
            pass
    return None

stats = {}

for idx, row in df.iterrows():
    role = str(row[role_col]).strip()
    completed_date_val = row[completed_date_col]
    confirm_val = row[confirm_col]
    
    if pd.isna(row[role_col]) or not role or role.lower() in ("nan", ""):
        continue
        
    if role not in stats:
        stats[role] = {
            "total_assigned": 0,
            "d0": 0, "d1": 0, "d2": 0,
            "d7": 0, "month": 0, "unconfirmed": 0
        }
        
    stats[role]["total_assigned"] += 1
    
    row_date = parse_date(completed_date_val)
    is_completed = row_date is not None
    is_confirmed = not pd.isna(confirm_val) and str(confirm_val).strip() != ""
    
    if is_completed:
        # Check 3 Day (d2/d1/d0)
        if row_date == d0:
            stats[role]["d0"] += 1
        elif row_date == d1:
            stats[role]["d1"] += 1
        elif row_date == d2:
            stats[role]["d2"] += 1
            
        # Check 7 Day
        if row_date >= d6_limit:
            stats[role]["d7"] += 1
            
        # Check Month
        if row_date.year == today.year and row_date.month == today.month:
            stats[role]["month"] += 1
            
        # Check Unconfirmed (cột H có ngày nhưng cột J trống)
        if not is_confirmed:
            stats[role]["unconfirmed"] += 1

print("\nAggregation Results:")
for role, s in sorted(stats.items()):
    print(f"{role}: Task assign: {s['total_assigned']} = 3 day: {s['d2']}/{s['d1']}/{s['d0']} | 7 day: {s['d7']} | Month: {s['month']} | Not Yet Confirm: {s['unconfirmed']} case")
