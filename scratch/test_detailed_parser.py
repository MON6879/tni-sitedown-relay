import pandas as pd
import requests
import io
import re

url = "https://docs.google.com/spreadsheets/d/1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y/gviz/tq?tqx=out:csv&sheet=Daily+report+and+Bussiness"

def extract_tni_codes(text: str) -> set:
    if not text:
        return set()
    return set(code.upper() for code in re.findall(r'TNI\d{3,5}(?:_\d+)?', text, re.IGNORECASE))

def get_employee_completed_tni_today_detailed(df_report, target_date: str) -> dict:
    completed = {}
    if df_report is None or df_report.empty:
        return completed
        
    date_idx = 2
    tg_idx = 17
    for col_idx, col_name in enumerate(df_report.columns):
        c_lower = col_name.lower().strip()
        if "daily report" in c_lower and not ":" in c_lower:
            date_idx = col_idx
        elif "telegram id" in c_lower:
            tg_idx = col_idx
            
    print(f"Date column: {df_report.columns[date_idx]} (idx: {date_idx})")
    print(f"Telegram ID column: {df_report.columns[tg_idx]} (idx: {tg_idx})")

    for idx, row in df_report.iterrows():
        date_cell = str(row.iloc[date_idx]).strip() if not pd.isna(row.iloc[date_idx]) else ""
        tg_id = str(row.iloc[tg_idx]).strip() if len(row) > tg_idx and not pd.isna(row.iloc[tg_idx]) else ""
        
        if not tg_id or tg_id.lower() in ("nan", "none"): continue
        if target_date and date_cell and target_date not in date_cell:
            continue
            
        cid = tg_id.replace(".0", "") if tg_id.endswith(".0") else tg_id
        
        emp_details = completed.setdefault(cid, {})
        for col_i in range(date_idx + 1, tg_idx):
            if col_i >= len(row):
                continue
            val = row.iloc[col_i]
            if pd.isna(val):
                continue
            val_str = str(val).strip()
            codes = extract_tni_codes(val_str)
            if codes:
                col_header = df_report.columns[col_i]
                for code in codes:
                    emp_details[code] = col_header
                    
    return completed

try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=0, dtype=str)
    
    # Test for July 8, 2026 (target_date = "8/7/2026")
    results = get_employee_completed_tni_today_detailed(df, "8/7/2026")
    print("\nDetailed Completed Map:")
    for cid, detail in results.items():
        print(f"Telegram ID: {cid}")
        for code, header in detail.items():
            print(f"  - {code} -> {header}")
except Exception as e:
    print("Error:", e)
