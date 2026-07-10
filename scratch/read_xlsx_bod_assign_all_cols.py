import pandas as pd

try:
    df = pd.read_excel("scratch/sheet.xlsx", sheet_name="BOD assign", header=None)
    print("BOD assign columns count:", df.shape[1])
    for idx in range(df.shape[1]):
        val = df.iloc[0, idx]
        print(f"  Col {chr(65 + idx) if idx < 26 else 'A' + chr(65 + idx - 26)} (index {idx}): {val}")
except Exception as e:
    print("Error:", e)
