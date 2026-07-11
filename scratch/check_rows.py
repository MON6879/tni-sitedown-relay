import requests, io, pandas as pd
r = requests.get('https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=133591305',
                 headers={'User-Agent':'Mozilla/5.0'}, timeout=20)
df = pd.read_csv(io.StringIO(r.text), header=None, dtype=str)
print('Total rows:', len(df), '| Cols:', len(df.columns))
print('\n=== Rows 54-72 (0-indexed) ===')
for i in range(54, min(73, len(df))):
    row = df.iloc[i]
    a = str(row.iloc[0])[:35] if pd.notna(row.iloc[0]) else ''
    b = str(row.iloc[1])[:25] if len(row)>1 and pd.notna(row.iloc[1]) else ''
    c = str(row.iloc[2])[:20] if len(row)>2 and pd.notna(row.iloc[2]) else ''
    e = str(row.iloc[4])[:15] if len(row)>4 and pd.notna(row.iloc[4]) else ''
    print(f'Row{i:3d}: A={a:<35} B={b:<25} C={c:<20} E={e}')
