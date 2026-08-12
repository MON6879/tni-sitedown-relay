import asyncio
import sys
sys.path.append('.')
from cron_send import generate_report_4_detailed
from daily_plan_report import build_daily_plan_report

print("==================================================")
print("📌 1. REPORT 4B (CHI TIẾT TỪNG NHÂN VIÊN FT & SITE WO/TASK)")
print("==================================================")
try:
    rep_4b_dict = generate_report_4_detailed()
    if rep_4b_dict:
        for tname, text in rep_4b_dict.items():
            print(f"--- [{tname}] ---")
            print(text[:1000])  # Print first 1000 chars of team 1
            print("...\n")
            break
except Exception as e:
    print("Error 4b:", e)

print("==================================================")
print("📌 2. REPORT 5 (ĐỐI SOÁT PLAN VS ACTUAL TỪNG NHÂN VIÊN)")
print("==================================================")
try:
    rep_5_text = build_daily_plan_report(mode="eod")
    print(rep_5_text[:1500])
except Exception as e:
    print("Error 5:", e)
