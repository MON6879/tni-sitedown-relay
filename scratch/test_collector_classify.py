import re

# Simulate keywords
KEYWORDS = ["order", "revoke", "export", "move", "asset sent", "destroys"]

def is_collector_msg(text: str) -> bool:
    if not text:
        return False
    text_l = text.lower()
    if "daily result" in text_l or "daily plan" in text_l:
        return False
    clean_text = text.strip()
    if clean_text.startswith("/"):
        cmd_m = re.match(r'^/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+(.*))?$', clean_text, re.DOTALL)
        if cmd_m:
            cmd = cmd_m.group(1).lower()
            for k in KEYWORDS:
                if cmd == k.replace(" ", "_") or cmd == k.replace(" ", ""):
                    return True
        return False
    first_line = clean_text.splitlines()[0].strip().lower()
    for k in KEYWORDS:
        k_esc = re.escape(k)
        if re.match(r'^\s*' + k_esc + r'\s*[:\-]', first_line):
            return True
        if re.match(r'^\s*' + k_esc + r'\s+\d', first_line):
            return True
        if re.match(r'^\s*' + k_esc + r'\s*$', first_line):
            return True
    return False

# Test cases
tests = [
    # (text, expected, description)
    ("Order: 12/08/2026\nSite: TNI0210\nQty: 10", True,  "Valid Order with date"),
    ("Revoke: TNI0210\nQty: 5",                    True,  "Valid Revoke"),
    ("Move:",                                       True,  "Valid Move alone with colon"),
    ("Move",                                        True,  "Valid Move keyword alone"),
    ("Export: 2 units",                             True,  "Valid Export"),
    ("Asset sent: TNI0210",                         True,  "Valid Asset sent"),
    ("/order",                                      True,  "Slash command /order"),
    ("Let me order something for you",              False, "Casual chat with 'order'"),
    ("We should move that asset tomorrow",          False, "Casual chat with 'move'"),
    ("can you export this report?",                 False, "Casual chat with 'export'"),
    ("Raja HO many site Request delay...",          False, "Casual chat with 'request'"),
    ("Hein Nanda do you submit letter finish?",     False, "Casual chat with 'letter'"),
    ("I think we need to revoke it",               False, "Casual chat with 'revoke'"),
    ("Daily plan Team 3",                           False, "Daily plan excluded"),
    ("Order\nDate: 12/08/2026",                    True,  "Order on first line only"),
    ("Note: please order some\nOrder: TNI",         False, "Order NOT on first line - should FAIL"),
]

passed = failed = 0
for text, expected, desc in tests:
    result = is_collector_msg(text)
    ok = result == expected
    icon = "✅ PASS" if ok else f"❌ FAIL (got={result}, want={expected})"
    print(f"[{icon}] {desc}")
    if ok: passed += 1
    else: failed += 1

print(f"\nTotal: {passed}/{len(tests)} passed, {failed} failed.")
