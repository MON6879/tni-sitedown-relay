import os
import gspread

def check_summary():
    creds_file = r"d:\6. AI\1. QLTC\ICT Fetch\credentials.json"
    if not os.path.exists(creds_file):
        creds_file = r"C:\Users\HA DUC PHONG\.gemini\antigravity\brain\bec257ae-d518-4c74-9e6d-1da22700bc72\credentials.json"
        
    gsheet_id = "1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0"
    
    gc = gspread.service_account(filename=creds_file)
    sh = gc.open_by_key(gsheet_id)
    ws = sh.worksheet("Summary")
    
    values = ws.get_all_values()
    print(f"Total rows in Summary worksheet: {len(values)}")
    print("First 15 rows of Summary:")
    for i, row in enumerate(values[:15]):
        print(f"  Row {i+1}: {row}")

if __name__ == "__main__":
    check_summary()
