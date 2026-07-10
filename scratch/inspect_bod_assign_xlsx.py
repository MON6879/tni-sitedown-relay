import pandas as pd

df = pd.read_excel("scratch/sheet.xlsx", sheet_name="BOD assign")
print("BOD assign sheet shape:", df.shape)
print("\nColumns:")
for i, col in enumerate(df.columns):
    print(f"Col {i} ({chr(65+i)}): {col}")

print("\nFirst 15 rows:")
print(df.head(15).to_string())
