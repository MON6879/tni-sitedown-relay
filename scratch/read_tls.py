import pandas as pd

try:
    df = pd.read_excel("scratch/sheet.xlsx", sheet_name="Task remain", header=None)
    print("Reading rows 33 to 59 in Task remain...")
    # Rows are 0-indexed in pandas, so rows 33-59 are indices 32 to 58
    for idx in range(32, min(59, len(df))):
        row = df.iloc[idx]
        row_str = " | ".join(str(val) for val in row.dropna())
        print(f"Row {idx+1}: {row_str}")
except Exception as e:
    print("Error:", e)
