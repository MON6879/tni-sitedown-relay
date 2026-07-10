import pandas as pd

try:
    excel_file = "scratch/sheet.xlsx"
    xl = pd.ExcelFile(excel_file)
    for tab in ["User IDs", "Chat IDs"]:
        if tab in xl.sheet_names:
            df = xl.parse(tab, header=None)
            print(f"\n=== {tab} ===")
            for idx, row in df.iterrows():
                row_str = " | ".join(str(val) for val in row.dropna())
                if any(x in row_str.lower() for x in ["win", "htet", "hter", "aung"]):
                    print(f"Row {idx+1}: {row_str}")
except Exception as e:
    print("Error:", e)
