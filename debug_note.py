import requests, io, pandas as pd
SPREADSHEET_ID = '1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8'
url = f'https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=1236389870'
r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
print('Status:', r.status_code)
df = pd.read_csv(io.StringIO(r.text), header=None, dtype=str, on_bad_lines='skip')
print('Shape:', df.shape, '| Cols:', len(df.columns))
print()
print('=== 5 dong dau, tat ca cot ===')
for r_idx in range(min(5, len(df))):
    row_data = [str(df.iloc[r_idx].iloc[c]).strip() for c in range(len(df.columns))]
    print(f'Row{r_idx}: {row_data}')
print()
# Check col G (index 6) and H (index 7)
print('=== Col G (index 6) rows 0-4 ===')
for r_idx in range(min(5, len(df))):
    if len(df.columns) > 6:
        val = str(df.iloc[r_idx].iloc[6]).strip()
        print(f'  G{r_idx+1}: [{val}]')
    else:
        print('  Less than 7 cols!')
