import pandas as pd

try:
    df = pd.read_excel("scratch/sheet.xlsx", sheet_name="BOD assign", header=None)
    print("BOD assign columns (first row):")
    for idx, val in enumerate(df.iloc[0]):
        print(f"  Col {chr(65+idx)} (index {idx}): {val}")
except Exception as e:
    print("Error:", e)
