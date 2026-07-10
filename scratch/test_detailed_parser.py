import re

text = """1.Date =8/7/2026
2. Mytel DG ID  TNI0004(DG2)
3. DG Type        -YANMAR(30)kva
4. Power  Mode - DG+Battery
5. Goverment Price:
6: Partner price:5500
7: How many percent increase: %
8: Reason price higher than Goverment:Currently Taningharyi township region cannot buy fuel from fuel station and Fuel take from Myeik and transport to TNI0004,on the way have many checking gate and have to paid fee those gate for pass with  fuel and price was higher than station price.
9: Filling fuel: 
DG Running Hour -35817hrs-mins
DG KWH Hours-97527KWH
Actual Filled Qty(L) -843L
1Liter price=5500MMK
Fuel Filling Team03
Following Mr Myeat Ko Ko Aung
Before
Fuel Level %-00
CSU Reading(L) -00
Fuel Liter/cm        -(1)17L

After
Fuel Level %        -00
CSU Reading(L)-00
Fuel Liter/cm        -(49)860L
Emergency Fuel Fill"""

def parse_refueled(txt):
    def search(pat, default=""):
        m = re.search(pat, txt, re.IGNORECASE)
        return m.group(1).strip() if m else default

    date_val = search(r"Date\s*=\s*(\d{1,2}/\d{1,2}/\d{4})")
    dg_id = search(r"DG\s*ID\s+([^\r\n]+)")
    site_id = ""
    if dg_id:
        sm = re.search(r"TNI\d{4}", dg_id, re.IGNORECASE)
        if sm:
            site_id = sm.group(0).upper()
            
    team_val = search(r"Team\s*(\d+)")
    if team_val:
        team_val = f"Team {int(team_val)}"
        
    rh = search(r"Running\s*Hour\s*-?\s*(\d+)")
    kwh = search(r"KWH\s*Hours?\s*-?\s*(\d+)")
    
    # Parse Before block
    before_part = ""
    bm = re.search(r"Before([\s\S]*?)(?:After|$)", txt, re.IGNORECASE)
    if bm:
        before_part = bm.group(1)
        
    before_csu = re.search(r"CSU\s*Reading\s*\(L\)\s*-?\s*(\d+)", before_part, re.IGNORECASE)
    before_csu = before_csu.group(1) if before_csu else ""
    before_lvl = re.search(r"Level\s*%\s*-?\s*(\d+)", before_part, re.IGNORECASE)
    before_lvl = before_lvl.group(1) if before_lvl else ""
    before_cm = re.search(r"Liter/cm[\s\S]*?-\s*\(\d+\)\s*(\d+)\s*[Ll]", before_part, re.IGNORECASE)
    before_cm = before_cm.group(1) if before_cm else ""

    # Parse After block
    after_part = ""
    am = re.search(r"After([\s\S]*?)$", txt, re.IGNORECASE)
    if am:
        after_part = am.group(1)
        
    after_csu = re.search(r"CSU\s*Reading\s*\(L\)\s*-?\s*(\d+)", after_part, re.IGNORECASE)
    after_csu = after_csu.group(1) if after_csu else ""
    after_lvl = re.search(r"Level\s*%\s*-?\s*(\d+)", after_part, re.IGNORECASE)
    after_lvl = after_lvl.group(1) if after_lvl else ""
    after_cm = re.search(r"Liter/cm[\s\S]*?-\s*\(\d+\)\s*(\d+)\s*[Ll]", after_part, re.IGNORECASE)
    after_cm = after_cm.group(1) if after_cm else ""

    filled = search(r"Actual\s*Filled\s*Qty\s*\(L\)\s*-?\s*(\d+)")
    price = search(r"1Liter\s*price\s*=\s*(\d+)")
    if not price:
        price = search(r"Partner\s*price\s*:\s*(\d+)")

    print("Parsed values:")
    print("  Date:", date_val)
    print("  DG ID:", dg_id)
    print("  Site ID:", site_id)
    print("  Team:", team_val)
    print("  RH:", rh)
    print("  KWh:", kwh)
    print("  Before: CSU:", before_csu, "Lvl%:", before_lvl, "Cm:", before_cm)
    print("  After: CSU:", after_csu, "Lvl%:", after_lvl, "Cm:", after_cm)
    print("  Filled Qty:", filled)
    print("  Price:", price)

if __name__ == "__main__":
    parse_refueled(text)
