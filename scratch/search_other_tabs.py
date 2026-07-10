import pandas as pd

try:
    excel_file = "scratch/sheet.xlsx"
    xl = pd.ExcelFile(excel_file)
    print("Searching in other tabs...")
    for sheet_name in xl.sheet_names:
        if sheet_name == "Task remain":
            continue
        df = xl.parse(sheet_name, header=None)
        for idx, row in df.iterrows():
            row_str = " | ".join(str(val) for val in row.dropna())
            if any(x in row_str.lower() for x in ["winhtet", "winhter", "win htet", "win hter"]):
                print(f"[{sheet_name}] Row {idx+1}: {row_str}")
except Exception as e:
    print("Error:", e)
