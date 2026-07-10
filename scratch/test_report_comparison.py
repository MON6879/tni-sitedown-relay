import sys
import asyncio
from datetime import datetime, timezone
import os

# Load .env manually
env = {}
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()

os.environ["SEND_BOT_TOKEN"] = env.get("SEND_BOT_TOKEN", "")
os.environ["REPORT_TASK_BOT_TOKEN"] = env.get("REPORT_TASK_BOT_TOKEN", "")
os.environ["TECHNICAL_DEP_BOT_TOKEN"] = env.get("TECHNICAL_DEP_BOT_TOKEN", "")
os.environ["APPS_SCRIPT_URL"] = env.get("APPS_SCRIPT_URL", "")
os.environ["TELEGRAM_API_ID"] = env.get("TELEGRAM_API_ID", "")
os.environ["TELEGRAM_API_HASH"] = env.get("TELEGRAM_API_HASH", "")
os.environ["TELEGRAM_SESSION"] = env.get("TELEGRAM_SESSION", "")

sys.path.append('.')
from daily_plan_report import (
    get_unified_employees,
    get_daily_reports_from_sheet,
    get_employee_report_counts,
    get_employee_completed_tni_today_detailed,
    is_employee_in_cell
)

def test():
    date_str = "08/07/2026"
    print(f"Testing comparison for {date_str}...")
    
    # 1. Fetch employees
    employees = get_unified_employees()
    t4_emps = [e for e in employees if e.get("team") == "T4"]
    print(f"Total T4 Employees loaded: {len(t4_emps)}")
    for e in t4_emps:
        print(f"  Name: {e.get('name')}, Sys: {e.get('sys_name')}, TG_ID: {e.get('telegram_id')}")
        
    # 2. Get Daily Reports raw
    team_reports, df_report_raw = get_daily_reports_from_sheet(date_str)
    
    # 3. Get counts
    daily_counts = get_employee_report_counts(employees)
    
    # 4. Get completed details
    emp_completed_details = get_employee_completed_tni_today_detailed(df_report_raw, date_str, t4_emps)
    
    print("\nResults for T4 Employees:")
    for emp in t4_emps:
        name = emp.get("name", "")
        sys_name = emp.get("sys_name", "")
        tg_id = str(emp.get("telegram_id", "")).replace(".0", "")
        
        sent_today = False
        if daily_counts and tg_id in daily_counts:
            sent_today = (daily_counts[tg_id].get("d0", 0) > 0)
            
        completed_detail = emp_completed_details.get(tg_id, {})
        
        print(f"\nEmployee: {name} (Username: {sys_name}, TG_ID: {tg_id})")
        print(f"  Report Sent Today? {sent_today}")
        print(f"  Completed TNI codes: {list(completed_detail.keys())}")
        if daily_counts and tg_id in daily_counts:
            print(f"  Daily Counts: {daily_counts[tg_id]}")

if __name__ == "__main__":
    test()
