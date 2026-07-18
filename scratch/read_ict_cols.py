import os
import pandas as pd
import gspread

def inspect_sheet():
    creds_file = r"d:\6. AI\1. QLTC\ICT Fetch\credentials.json"
    if not os.path.exists(creds_file):
        creds_file = r"C:\Users\HA DUC PHONG\.gemini\antigravity\brain\bec257ae-d518-4c74-9e6d-1da22700bc72\credentials.json"
        
    gsheet_id = "1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0"
    tab_name = "Input ICT"
    
    print("Connecting to Google Sheets...")
    gc = gspread.service_account(filename=creds_file)
    sh = gc.open_by_key(gsheet_id)
    ws = sh.worksheet(tab_name)
    
    # Read first 15 rows, columns A to BS (columns 1 to 71)
    values = ws.get_values("A1:BS15")
    print(f"Read {len(values)} rows.")
    for i, row in enumerate(values):
        print(f"Row {i+1}:")
        print(f"  Col A (0): {row[0] if len(row) > 0 else ''}")
        print(f"  Col B (1): {row[1] if len(row) > 1 else ''}")
        print(f"  Col G (6): {row[6] if len(row) > 6 else ''}")
        print(f"  Col AE (30): {row[30] if len(row) > 30 else ''}")
        print(f"  Col BC (54): {row[54] if len(row) > 54 else ''}")
        print("-" * 40)

if __name__ == "__main__":
    inspect_sheet()
