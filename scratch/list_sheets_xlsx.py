import openpyxl

wb = openpyxl.load_workbook("scratch/sheet.xlsx", read_only=True)
print("Sheet names in workbook:")
for name in wb.sheetnames:
    print(f"- {name}")
