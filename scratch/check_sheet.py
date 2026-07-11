import pandas as pd

url = 'https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=csv&gid=1095689918'
df = pd.read_csv(url)

print('=== CÁC CỘT TRONG SHEET ===')
for i, col in enumerate(df.columns):
    print(f'  [{i}] {repr(col)}')

print(f'\n=== 5 DÒNG ĐẦU (chỉ các cột quan trọng) ===')
print(df.head(5).to_string())
