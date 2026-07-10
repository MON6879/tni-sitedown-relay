import openpyxl
from datetime import datetime, timezone, timedelta

# Create dummy mock data for testing
mock_records = [
    # 3 days ago, category PLAN, sender Bone Myat Naing
    {"ts": datetime.now() - timedelta(days=1), "date": (datetime.now() - timedelta(days=1)).strftime("%d/%m/%Y"), "cat": "PLAN", "sender": "Bone Myat Naing", "sender_id": "6135125663", "site": "TNI0061", "qty": 440},
    {"ts": datetime.now() - timedelta(days=2), "date": (datetime.now() - timedelta(days=2)).strftime("%d/%m/%Y"), "cat": "PLAN", "sender": "Bone Myat Naing", "sender_id": "6135125663", "site": "TNI0319", "qty": 440},
    # 5 days ago
    {"ts": datetime.now() - timedelta(days=5), "date": (datetime.now() - timedelta(days=5)).strftime("%d/%m/%Y"), "cat": "PLAN", "sender": "Bhone Htet Aung", "sender_id": "8540261626", "site": "TNI0049", "qty": 400},
    # Today PLAN vs REFUELED vs REQUEST
    {"ts": datetime.now(), "date": datetime.now().strftime("%d/%m/%Y"), "cat": "PLAN", "sender": "Aung Lwin Phyo", "sender_id": "5779222454", "site": "TNI0061", "qty": 440},
    {"ts": datetime.now(), "date": datetime.now().strftime("%d/%m/%Y"), "cat": "REFUELED", "sender": "Aung Lwin Phyo", "sender_id": "5779222454", "site": "TNI0061", "qty": 440},
    {"ts": datetime.now(), "date": datetime.now().strftime("%d/%m/%Y"), "cat": "REQUEST", "sender": "Aung Lwin Phyo", "sender_id": "5779222454", "site": "TNI0061", "qty": 440},
    # Today Diff
    {"ts": datetime.now(), "date": datetime.now().strftime("%d/%m/%Y"), "cat": "PLAN", "sender": "Thar Htoo Aung", "sender_id": "6132505154", "site": "TNI0319", "qty": 440},
    {"ts": datetime.now(), "date": datetime.now().strftime("%d/%m/%Y"), "cat": "REFUELED", "sender": "Thar Htoo Aung", "sender_id": "6132505154", "site": "TNI0319", "qty": 400},
    {"ts": datetime.now(), "date": datetime.now().strftime("%d/%m/%Y"), "cat": "REQUEST", "sender": "Thar Htoo Aung", "sender_id": "6132505154", "site": "TNI0319", "qty": 440},
]

class MockData:
    def __init__(self):
        self.members = [
            {"id": "6135125663", "name": "Bone Myat Naing"},
            {"id": "8540261626", "name": "Bhone Htet Aung"},
            {"id": "5779222454", "name": "Aung Lwin Phyo"},
            {"id": "6132505154", "name": "Thar Htoo Aung"},
            {"id": "5291733181", "name": "Paing Aung Soe"}
        ]
        self.not_joined = ["Si Thu Ye Htun"]
        self.target_ids = ["6135125663", "8540261626", "5779222454"]
        self.records = mock_records

def fmt_row(col_a: str, col_b: str, col_c: str, col_d: str) -> str:
    return f"<code>{col_a:<12} {col_b:>6} {col_c:>6} {col_d:>6}</code>"

def test_preview():
    data = MockData()
    now = datetime.now()
    today_str = now.strftime("%d/%m/%Y")
    
    # --- REPORT 1 ---
    freq = {}
    for r in data.records:
        if r["cat"] != "PLAN": continue
        diff = now - r["ts"]
        site = r["site"]
        if site not in freq: freq[site] = {"d3": 0, "d7": 0, "d30": 0}
        if diff <= timedelta(days=3): freq[site]["d3"] += 1
        if diff <= timedelta(days=7): freq[site]["d7"] += 1
        if diff <= timedelta(days=30): freq[site]["d30"] += 1
        
    print("=== REPORT 1 PREVIEW ===")
    r1 = [f"📊 <b>PLAN SUBMISSION FREQUENCY</b>", fmt_row("Site ID", "3Days", "7Days", "1Month"), "<code>" + "─"*33 + "</code>"]
    for s in sorted(freq.keys()):
        r1.append(fmt_row(s, f"{freq[s]['d3']}x", f"{freq[s]['d7']}x", f"{freq[s]['d30']}x"))
    print("\n".join(r1))
    
    # --- REPORT 2 ---
    plan, ref = {}, {}
    for r in data.records:
        if r["date"] != today_str: continue
        if r["cat"] == "PLAN": plan[r["site"]] = plan.get(r["site"], 0) + r["qty"]
        elif r["cat"] == "REFUELED": ref[r["site"]] = ref.get(r["site"], 0) + r["qty"]
    
    print("\n=== REPORT 2 PREVIEW ===")
    r2 = [f"⛽ <b>PLAN vs REFUELED — {today_str}</b>", fmt_row("Site ID", "Plan", "Filled", "Diff"), "<code>" + "─"*33 + "</code>"]
    for s in sorted(set(list(plan.keys()) + list(ref.keys()))):
        p = plan.get(s, 0)
        f = ref.get(s, 0)
        d = f - p
        icon = "✅" if d == 0 else "❌"
        r2.append(f"{icon} {fmt_row(s, f'{p}L', f'{f}L', f'{d}L')}")
    print("\n".join(r2))
    
    # --- REPORT 3 ---
    plan, req = {}, {}
    for r in data.records:
        if r["date"] != today_str: continue
        if r["cat"] == "PLAN": plan[r["site"]] = plan.get(r["site"], 0) + r["qty"]
        elif r["cat"] == "REQUEST": req[r["site"]] = req.get(r["site"], 0) + r["qty"]
        
    print("\n=== REPORT 3 PREVIEW ===")
    match_rows, diff_rows = [], []
    for s in sorted(set(list(plan.keys()) + list(req.keys()))):
        p = plan.get(s, 0)
        q = req.get(s, 0)
        row = fmt_row(s, f"{q}L", f"{p}L", "=" if p == q else f"{p-q}L")
        if p == q: match_rows.append(row)
        else: diff_rows.append(row)
    r3 = [f"🔄 <b>PLAN vs TEAM REQUEST — {today_str}</b>"]
    if match_rows:
        r3 += ["\n✅ <b>MATCH (same quantity)</b>", fmt_row("Site ID", "Request", "Plan", "Diff")] + match_rows
    if diff_rows:
        r3 += ["\n⚠️ <b>DIFF (different quantity)</b>", fmt_row("Site ID", "Request", "Plan", "Diff")] + diff_rows
    print("\n".join(r3))

    # --- REPORT 4 ---
    req_freq = {}
    for r in data.records:
        if r["cat"] != "REQUEST": continue
        diff = now - r["ts"]
        sid = r["sender_id"]
        if sid not in req_freq: req_freq[sid] = {"d3": 0, "d7": 0, "d30": 0}
        if diff <= timedelta(days=3): req_freq[sid]["d3"] += 1
        if diff <= timedelta(days=7): req_freq[sid]["d7"] += 1
        if diff <= timedelta(days=30): req_freq[sid]["d30"] += 1
        
    print("\n=== REPORT 4 PREVIEW ===")
    r4 = [f"👤 <b>REFUEL REQUESTS BY PERSON</b>", fmt_row("Name", "3Days", "7Days", "1Month"), "<code>" + "─"*33 + "</code>"]
    for m in data.members:
        f = req_freq.get(m["id"], {"d3": 0, "d7": 0, "d30": 0})
        r4.append(fmt_row(m["name"][:12], f"{f['d3']}x", f"{f['d7']}x", f"{f['d30']}x"))
    r4 += ["\n⚠️ <b>NOT JOINED GROUP (No Telegram ID)</b>"] + [f"• {name}" for name in data.not_joined]
    print("\n".join(r4))

    # --- REPORT 5 ---
    plan_freq = {}
    for r in data.records:
        if r["cat"] != "PLAN": continue
        diff = now - r["ts"]
        sid = r["sender_id"]
        if sid not in plan_freq: plan_freq[sid] = {"d3": 0, "d7": 0, "d30": 0}
        if diff <= timedelta(days=3): plan_freq[sid]["d3"] += 1
        if diff <= timedelta(days=7): plan_freq[sid]["d7"] += 1
        if diff <= timedelta(days=30): plan_freq[sid]["d30"] += 1
        
    print("\n=== REPORT 5 PREVIEW ===")
    r5 = [f"📋 <b>PLAN SUBMISSIONS BY TARGET LIST</b>", fmt_row("Name/ID", "3Days", "7Days", "1Month"), "<code>" + "─"*33 + "</code>"]
    member_map = {m["id"]: m["name"] for m in data.members}
    for tid in data.target_ids:
        name = member_map.get(tid, f"ID:{tid[-6:]}")
        f = plan_freq.get(tid, {"d3": 0, "d7": 0, "d30": 0})
        r5.append(fmt_row(name[:12], f"{f['d3']}x", f"{f['d7']}x", f"{f['d30']}x"))
    print("\n".join(r5))

if __name__ == "__main__":
    test_preview()
