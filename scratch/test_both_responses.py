import time
from datetime import datetime, timezone, timedelta
TZ_MM = timezone(timedelta(hours=6, minutes=30))

now_mm = datetime.now(TZ_MM)
time_str = now_mm.strftime('%H:%M')
date_str = now_mm.strftime('%d/%m/%Y')

plan_res = f"✅ <b>Plan saved ({time_str})</b> — REF:<b>DP-165</b> | {date_str}"
result_res = f"✅ <b>Result saved ({time_str})</b> — REF:<b>265</b> | {date_str}"

print("PLAN RESPONSE:")
print(plan_res)
print("\nRESULT RESPONSE:")
print(result_res)
