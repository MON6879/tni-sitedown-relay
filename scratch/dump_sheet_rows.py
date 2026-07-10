import requests, io, pandas as pd
r = requests.get('https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=133591305',
                 headers={'User-Agent':'Mozilla/5.0'}, timeout=20)
df = pd.read_csv(io.StringIO(r.text), header=None, dtype=str)
print(f"Total rows in sheet: {len(df)}")
for idx, row in df.iterrows():
    sheet_row = idx + 1
    if sheet_row < 4 or sheet_row > 87:
        continue
    col_a = row.iloc[0] if len(row) > 0 and pd.notna(row.iloc[0]) else ''
    col_b = row.iloc[1] if len(row) > 1 and pd.notna(row.iloc[1]) else ''
    col_c = row.iloc[2] if len(row) > 2 and pd.notna(row.iloc[2]) else ''
    col_d = row.iloc[3] if len(row) > 3 and pd.notna(row.iloc[3]) else ''
    col_e = row.iloc[4] if len(row) > 4 and pd.notna(row.iloc[4]) else ''
    print(f"Row {sheet_row:2d} | A: {col_a:<25} | B: {col_b:<20} | C: {col_c:<15} | E: {col_e:<12} | D: {col_d[:40]}...")
