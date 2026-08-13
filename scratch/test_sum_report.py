import asyncio
import sys
sys.path.append('.')
from cron_send import parse_emp

# Sample Cột D text from user's screenshot
sample_col_d = """Aung Lwin Phyo /myt_aunglwin.phyo => Site: /39 : 'TNI0264+ TNI0201 : 8KVA= 6L + TNI0170 : 8KVA= 6L + TNI0322 : 8KVA= 6L <> Day /23 of the month= /4 WO Close <=> 7day: /0 C <=> rank: /18 =Close: /18% /TARGET75% /LostTARGET => /WO /Overdue /FOT /NOT /Close: /0 => 3Day Close: 0/0/0 => TNI0041, TNI0005, TNI0067, TNI0068, TNI0201, TNI0031, TNI0053, TNI0066, TNI0050 => Manager : 1/P: 0 Asset : 3/P: 1 CM : 3/P: 0 M&E : 7/P: 0 PM : 12/P: 0 + Alarm need repair: Cell Down: /TNI0319 - 5469, /TNI0264 - 6164 : : Smoke: /TNI0319 - 1168, /TNI0041 - 12567, /TNI0322 - 4473 : Open Door: /TNI0322: +Battery Door: 25/06/2026 13:39 +Battery Door: 25/06/2026 13:39 - 1168, /TNI0264: +Battery Door: 03/02/2025 11:20 - 13397"""

print("Original Col D text len:", len(sample_col_d))
parsed = parse_emp(sample_col_d)
print("\n--- Parsed Summary Output ---")
print(parsed)
