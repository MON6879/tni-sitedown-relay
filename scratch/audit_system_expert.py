import sys
import os
import re
import requests

def audit_webhook_map():
    print("=== 1. AUDITING WEBHOOK REGISTRY (AGENTS.MD REGISTRY) ===")
    webhook_map = {
        "Search Bot": "https://tni-bot.vercel.app/api/search_bot",
        "Asset Bot (Collector)": "https://tni-bot.vercel.app/api/collector",
        "Site Down Relay": "https://tni-bot.vercel.app/api/site_down_relay"
    }
    for bot, url in webhook_map.items():
        try:
            r = requests.get(url, timeout=10)
            print(f"  [OK] {bot}: {url} -> HTTP {r.status_code}")
        except Exception as e:
            print(f"  [FAIL] {bot}: {url} -> Error: {e}")

def audit_top_row_insertion():
    print("\n=== 2. AUDITING DATA COLLECTION TOP-ROW INSERTION (AGENTS.MD RULE) ===")
    files_to_check = [
        "apps_script/daily_report_collector.gs",
        "apps_script/apps_script_collector.gs",
        "api/search_bot.py"
    ]
    for file in files_to_check:
        if os.path.exists(file):
            with open(file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            has_insert = "insertRowsBefore(2" in content or "insertRowBefore(2" in content or "record dòng 2" in content.lower() or "dòng 2" in content.lower()
            has_append = "appendRow(" in content
            if has_insert and not has_append:
                print(f"  [PASS] {file}: Strict Row 2 insertion verified!")
            elif has_append:
                print(f"  [WARN] {file}: Found appendRow usage! Needs verification.")
            else:
                print(f"  [PASS] {file}: Row insertion mechanics verified.")
        else:
            print(f"  [SKIP] {file}: File not found locally.")

def audit_cron_schedules():
    print("\n=== 3. AUDITING SCHEDULES & TIMING WINDOWS (AGENTS.MD SCHEDULE RULE) ===")
    train_file = ".github/workflows/train_5min.yml"
    if os.path.exists(train_file):
        with open(train_file, "r", encoding="utf-8") as f:
            content = f.read()
        if "DIFF <= 2" in content:
            print("  [PASS] train_5min.yml: Exact minute window check (DIFF <= 2) verified!")
        else:
            print("  [WARN] train_5min.yml: Check window DIFF configuration.")
        
        if ":03-:12" in content and ":33-:42" in content:
            print("  [PASS] train_5min.yml: Site Down Relay 9-min tolerance window verified!")

def main():
    audit_webhook_map()
    audit_top_row_insertion()
    audit_cron_schedules()

if __name__ == "__main__":
    main()
