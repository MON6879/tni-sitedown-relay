import os
import gspread

def setup_summary():
    creds_file = r"d:\6. AI\1. QLTC\ICT Fetch\credentials.json"
    if not os.path.exists(creds_file):
        creds_file = r"C:\Users\HA DUC PHONG\.gemini\antigravity\brain\bec257ae-d518-4c74-9e6d-1da22700bc72\credentials.json"
        
    gsheet_id = "1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0"
    
    print("Connecting to Google Sheets...")
    gc = gspread.service_account(filename=creds_file)
    sh = gc.open_by_key(gsheet_id)
    
    # Check if Summary sheet already exists, delete if it does to recreate
    try:
        ws = sh.worksheet("Summary")
        sh.del_worksheet(ws)
        print("Existing Summary sheet deleted.")
    except gspread.exceptions.WorksheetNotFound:
        pass
        
    # Create a new Summary sheet
    ws = sh.add_worksheet(title="Summary", rows=1000, cols=10)
    print("Created new Summary sheet.")
    
    # Write headers
    headers = [
        ["Summary Report (Diff >= 10)", "", "", "", "", ""],
        ["Group", "Site", "BC - AE (C)", "AE - G (D)", "Diff (C-D = E)", "Summary Report (F)"]
    ]
    ws.update(values=headers, range_name="A1:F2", value_input_option="USER_ENTERED")
    
    # Generate formulas for rows 3 to 1000
    formulas = []
    for r in range(3, 1001):
        row_formulas = [
            f"='Input ICT'!A{r}",
            f"='Input ICT'!B{r}",
            f"=IFERROR(VALUE('Input ICT'!BC{r}) - VALUE('Input ICT'!AE{r}), \"\")",
            f"=IFERROR(VALUE('Input ICT'!AE{r}) - VALUE('Input ICT'!G{r}), \"\")",
            f"=IF(AND(ISNUMBER(C{r}), ISNUMBER(D{r})), C{r} - D{r}, \"\")",
            f"=IF(AND(ISNUMBER(E{r}), ABS(E{r})>=10), A{r} & \" : \" & B{r} & \" = \" & C{r} & \" - \" & D{r} & \" = \" & E{r}, \"\")"
        ]
        formulas.append(row_formulas)
        
    ws.update(values=formulas, range_name="A3:F1000", value_input_option="USER_ENTERED")
    print("Populated formulas from row 3 to 1000.")
    
    # Apply some basic formatting: freeze the first 2 rows
    ws.freeze(rows=2)
    print("Froze headers.")

if __name__ == "__main__":
    setup_summary()
