import pandas as pd

try:
    df = pd.read_excel("scratch/sheet.xlsx", sheet_name="Task remain", header=None)
    print("Loaded Task remain sheet. Total rows:", len(df))
    for idx, row in df.iterrows():
        row_str = " | ".join(str(val) for val in row.dropna())
        if any(x in row_str.lower() for x in ["win", "htet", "hter", "aung"]):
            print(f"Row {idx+1}: {row_str}")
except Exception as e:
    print("Error:", e)
