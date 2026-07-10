import pandas as pd
import requests

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=xlsx"
try:
    print("Downloading spreadsheet...")
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=60)
    resp.raise_for_status()
    
    excel_file = "scratch/sheet.xlsx"
    with open(excel_file, "wb") as f:
        f.write(resp.content)
    print("Downloaded sheet.xlsx successfully.")
    
    # Load xlsx
    xl = pd.ExcelFile(excel_file)
    print("Sheet names:", xl.sheet_names)
    
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name, header=None)
        # Search in df
        for row_idx, row in df.iterrows():
            for col_idx, val in enumerate(row):
                if pd.notna(val) and ("Win Hter Aung" in str(val) or "Hter Aung" in str(val)):
                    print(f"[{sheet_name}] Row {row_idx+1}, Col {chr(65+col_idx)}: {repr(val)}")
except Exception as e:
    print("Error:", e)
