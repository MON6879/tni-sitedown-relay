import pandas as pd

try:
    df = pd.read_excel("scratch/sheet.xlsx", sheet_name="Task remain", header=None)
    print("Searching for 8296243972 in Task remain...")
    found = False
    for idx, row in df.iterrows():
        row_str = " | ".join(str(val) for val in row)
        if "8296243972" in row_str:
            print(f"Row {idx+1}: {row_str}")
            found = True
    if not found:
        print("Telegram ID 8296243972 NOT found in Task remain tab.")
except Exception as e:
    print("Error:", e)
