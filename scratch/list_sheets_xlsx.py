import pandas as pd
import requests

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=xlsx"
resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
with open("scratch/sheet.xlsx", "wb") as f:
    f.write(resp.content)

xls = pd.ExcelFile("scratch/sheet.xlsx")
print("Sheet Names:")
for sheet_name in xls.sheet_names:
    print(sheet_name)
