import re

def classify(text: str) -> str | None:
    t = text.lower().strip()
    
    # 1. FT_MONITOR
    if ("name of ft staff member" in t and "supervise" in t) or re.search(r'\bfollow\s*monit?er?\b', t):
        return "FT_MONITOR"

    # 2. REFUELED
    if "dg type" in t or "actual filled qty" in t:
        return "REFUELED"

    # 3. LETTER_SUBMIT (Must match template "Letter Submit:" / "Submit Letter:" with colon/dash or date)
    if re.search(r'^\s*(letter\s*submit|submit\s*letter)\s*[:\-]', t, re.M) or re.search(r'^\s*(letter\s*submit|submit\s*letter)\b.*\d{1,2}[/\-\.]\d{1,2}', t, re.M):
        return "LETTER_SUBMIT"

    # 4. LETTER_APPROVED (Must match template "Approved Letter:" / "Letter Approved:" with colon/dash or date)
    if re.search(r'^\s*(approved\s*letter|letter\s*approved)\s*[:\-]', t, re.M) or re.search(r'^\s*(approved\s*letter|letter\s*approved)\b.*\d{1,2}[/\-\.]\d{1,2}', t, re.M):
        return "LETTER_APPROVED"

    # 5. PLAN
    if re.search(r'^\s*team[\s_\-]*\w*\s*plan\b', t, re.M) or re.search(r'^\s*plan\s*refuel\b', t, re.M) or re.search(r'\bteam[\s_\-]*0*[1-4]\s*plan\b', t):
        return "PLAN"

    # 6. REQUEST
    if re.search(r'^\s*team[\s_\-]*\w*\s*request\b', t, re.M) or re.search(r'^\s*request\s*refuel\b', t, re.M) or re.search(r'\bteam[\s_\-]*0*[1-4]\s*request\b', t):
        return "REQUEST"

    # 7. Fallback for FT monitor
    if "tni" in t and ("l" in t or "+" in t) and ("monitor" in t or "supervise" in t):
        return "FT_MONITOR"

    return None


test_cases = [
    ("Hein Nanda do you submit letter finish?", None),
    ("Raja HO many site Request delay, you check your team make plan refuel for me not delay long time. Sunil Aung Naing Refuel Team", None),
    ("Letter Submit: 12/08/2026", "LETTER_SUBMIT"),
    ("Submit Letter: 12/08/2026", "LETTER_SUBMIT"),
    ("Approved Letter: 12/08/2026", "LETTER_APPROVED"),
    ("Letter Approved: 12/08/2026", "LETTER_APPROVED"),
    ("Team 1 Plan refuel 12/08/2026 : TNI0210 440L", "PLAN"),
    ("Team 2 request 12/08/2026: TNI0210: 440L", "REQUEST"),
    ("1. Date=10/8/2026\n2. Mytel site ID TNI0210\n3. DG Type -kubota (13)kva\nActual Filled Qty(L) -442 L", "REFUELED"),
    ("Name of FT staff member accompanying to supervise...", "FT_MONITOR"),
]

passed = 0
for text, expected in test_cases:
    res = classify(text)
    status = "✅ PASS" if res == expected else f"❌ FAIL (got '{res}', expected '{expected}')"
    print(f"[{status}] text='{text[:40]}...' -> {res}")
    if res == expected:
        passed += 1

print(f"\nTotal: {passed}/{len(test_cases)} passed.")
