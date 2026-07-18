import os
import gspread

def inspect_tabs():
    creds_file = r"d:\6. AI\1. QLTC\ICT Fetch\credentials.json"
    if not os.path.exists(creds_file):
        creds_file = r"C:\Users\HA DUC PHONG\.gemini\antigravity\brain\bec257ae-d518-4c74-9e6d-1da22700bc72\credentials.json"
        
    gsheet_id = "1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0"
    
    gc = gspread.service_account(filename=creds_file)
    sh = gc.open_by_key(gsheet_id)
    tabs = sh.worksheets()
    print("Worksheet tabs in this spreadsheet:")
    for t in tabs:
        print(f"  - {t.title} (ID: {t.id})")

if __name__ == "__main__":
    inspect_tabs()
