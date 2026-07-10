import pandas as pd

try:
    df = pd.read_excel("scratch/sheet.xlsx", sheet_name="Task remain", header=None)
    for idx, row in df.iterrows():
        row_str = " | ".join(str(val) for val in row.dropna())
        if "myothant" in row_str.lower():
            print(f"Row {idx+1}: {row_str}")
except Exception as e:
    print("Error:", e)
