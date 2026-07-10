import requests

url = "https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/export?format=xlsx"
try:
    print("Downloading entire spreadsheet as XLSX...")
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    with open("scratch/sheet.xlsx", "wb") as f:
        f.write(resp.content)
    print("Download complete. Saved to scratch/sheet.xlsx")
except Exception as e:
    print("Error:", e)
