import os
import gspread

def run_clean():
    creds_file = r"d:\6. AI\1. QLTC\ICT Fetch\credentials.json"
    if not os.path.exists(creds_file):
        creds_file = r"C:\Users\HA DUC PHONG\.gemini\antigravity\brain\bec257ae-d518-4c74-9e6d-1da22700bc72\credentials.json"
        
    gsheet_id = "1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0"
    
    print("Connecting to Google Sheets...")
    gc = gspread.service_account(filename=creds_file)
    sh = gc.open_by_key(gsheet_id)
    ws_input = sh.worksheet("Input ICT")
    ws_summary = sh.worksheet("Summary")
    
    print("Reading Input ICT data...")
    matrix = ws_input.get_all_values()
    
    def to_float(val):
        if not val:
            return 0.0
        val_clean = str(val).replace("--", "").strip()
        if not val_clean:
            return 0.0
        try:
            return float(val_clean)
        except ValueError:
            return 0.0
            
    summary_rows = []
    for r in range(2, len(matrix)):
        if len(matrix[r]) < 55:
            continue
        if not matrix[r][0] and not matrix[r][1]:
            continue
            
        group = matrix[r][0]
        site = matrix[r][1]
        
        g_str = matrix[r][6]
        ae_str = matrix[r][30]
        bc_str = matrix[r][54]
        
        if g_str == "--" and ae_str == "--" and bc_str == "--":
            continue
            
        val_g = to_float(g_str)
        val_ae = to_float(ae_str)
        val_bc = to_float(bc_str)
        
        c_val = val_bc - val_ae
        d_val = val_ae - val_g
        e_val = c_val - d_val
        
        if abs(e_val) >= 10:
            c_str = f"{int(c_val)}" if c_val.is_integer() else f"{c_val:.1f}"
            d_str = f"{int(d_val)}" if d_val.is_integer() else f"{d_val:.1f}"
            e_str = f"{int(e_val)}" if e_val.is_integer() else f"{e_val:.1f}"
            
            f_str = f"{group} : {site} = {c_str} - {d_str} = {e_str}"
            
            summary_rows.append([
                group,
                site,
                c_val,
                d_val,
                e_val,
                f_str
            ])
            
    print(f"Filtering complete. Found {len(summary_rows)} rows matching Diff >= 10.")
    
    ws_summary.clear()
    headers = [
        ["Summary Report (Diff >= 10)", "", "", "", "", ""],
        ["Group", "Site", "BC - AE (C)", "AE - G (D)", "Diff (C-D = E)", "Summary Report (F)"]
    ]
    
    all_summary_data = headers + summary_rows
    range_summary = f"A1:F{len(all_summary_data)}"
    ws_summary.update(values=all_summary_data, range_name=range_summary, value_input_option="USER_ENTERED")
    print("Summary sheet cleaned up successfully!")

if __name__ == "__main__":
    run_clean()
