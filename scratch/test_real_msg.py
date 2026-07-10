import re

text = """1. Date=1/7/2026
2. Mytel site ID TNI0105
3. DG Type  -Kubota(8)kva
4. Power Mode - DG+Battery
5. Goverment Price:
6: Partner price:6450
7: How many percent increase: %
8: Reason price higher than Goverment: Army not approve to carry fuel to this site area, cannot carry fuel from Bokpyin to this site and fuel was buying from village near this site and price was higher than station price.
9: Filling fuel: 
DG Running Hour -4245hrs-36mins
DG KWH Hour-12396KWH
Actual Filled Qty(L) -227L
1Liter price=6450MMK
Fuel Filling Team03
Following Mr Pyae Phyo Zaw
Before
Fuel Level %-22
CSU Reading(L) -141
Fuel Liter/cm  -(1)8L

After
Fuel Level %  -22
CSU Reading(L)-141
Fuel Liter/cm  -(28)235L
Emergency Fuel Fill
Note Unsafe Site
Mention: CC:Mr @Phonghd @Anh Phan Minh Loi (Bhone Min Lu) @Kha yay Phoo (TNI) @Hein Nanda-M&E-2022"""

def search(pat, default=""):
    m = re.search(pat, text, re.IGNORECASE)
    return m.group(1).strip() if m else default

# Date - support both "Date =X" and "Date=X"
date_val = search(r"Date\s*[=:]\s*(\d{1,2}/\d{1,2}/\d{4})")

# DG ID - support "DG ID TNI..." and "site ID TNI..."
dg_id = search(r"(?:DG\s*ID|site\s*ID)\s+([^\r\n]+)")
site_id = ""
if dg_id:
    sm = re.search(r"TNI\d{4}", dg_id, re.IGNORECASE)
    if sm:
        site_id = sm.group(0).upper()

# Team
team_val = search(r"Team\s*(\d+)")
if team_val:
    team_val = f"Team {int(team_val)}"

# Running Hour, KWH
rh = search(r"Running\s*Hour\s*-?\s*(\d+)")
kwh = search(r"KWH\s*Hour[s]?\s*-?\s*(\d+)")

# Before block
before_part = ""
bm = re.search(r"Before([\s\S]*?)(?:After|$)", text, re.IGNORECASE)
if bm:
    before_part = bm.group(1)

before_csu = re.search(r"CSU\s*Reading\s*\(L\)\s*-?\s*(\d+)", before_part, re.IGNORECASE)
before_csu = before_csu.group(1) if before_csu else ""
before_lvl = re.search(r"Level\s*%\s*-?\s*(\d+)", before_part, re.IGNORECASE)
before_lvl = before_lvl.group(1) if before_lvl else ""
before_cm = re.search(r"Liter/cm[\s\S]*?-\s*\(\d+\)\s*(\d+)\s*[Ll]?", before_part, re.IGNORECASE)
before_cm = before_cm.group(1) if before_cm else ""

# After block
after_part = ""
am = re.search(r"After([\s\S]*?)(?:Emergency|Note|Mention|$)", text, re.IGNORECASE)
if am:
    after_part = am.group(1)

after_csu = re.search(r"CSU\s*Reading\s*\(L\)\s*-?\s*(\d+)", after_part, re.IGNORECASE)
after_csu = after_csu.group(1) if after_csu else ""
after_lvl = re.search(r"Level\s*%\s*-?\s*(\d+)", after_part, re.IGNORECASE)
after_lvl = after_lvl.group(1) if after_lvl else ""
after_cm = re.search(r"Liter/cm[\s\S]*?-\s*\(\d+\)\s*(\d+)\s*[Ll]?", after_part, re.IGNORECASE)
after_cm = after_cm.group(1) if after_cm else ""

# Filled & Price
filled = search(r"Actual\s*Filled\s*Qty\s*\(L\)\s*-?\s*(\d+)")
price = search(r"1Liter\s*price\s*=\s*(\d+)")
if not price:
    price = search(r"Partner\s*price\s*:\s*(\d+)")

filled_n = int(filled) if filled else 0
price_n = int(price) if price else 0
total = filled_n * price_n

print("=" * 50)
print("Parsed Refueled Message:")
print("=" * 50)
print(f"  Date      : {date_val}")
print(f"  DG ID     : {dg_id}")
print(f"  Site ID   : {site_id}")
print(f"  Team      : {team_val}")
print(f"  RH        : {rh} hrs")
print(f"  KWh       : {kwh}")
print(f"  Before CSU: {before_csu} L  | Level: {before_lvl}%  | Cm: {before_cm} L")
print(f"  After CSU : {after_csu} L  | Level: {after_lvl}%  | Cm: {after_cm} L")
print(f"  Filled    : {filled} L")
print(f"  Price/L   : {price} MMK")
print(f"  Total     : {total:,} MMK")
