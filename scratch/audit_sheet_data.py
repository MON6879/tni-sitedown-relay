import urllib.request
import csv
import io
import re

url_sum = 'https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/export?format=csv&gid=1840482617'
content = urllib.request.urlopen(url_sum).read().decode('utf-8-sig')
rows = list(csv.reader(io.StringIO(content)))

print(f"Total Rows in Sum all WO Team: {len(rows)}")

# Print Row 0 (Target Need Complete)
print("\n--- Row 0 (Target) ---")
if len(rows) > 0:
    print(rows[0][:10])

# Print Row 1 (Header row)
print("\n--- Row 1 (Headers) ---")
if len(rows) > 1:
    print(rows[1][:15])

# Print Rows 52-55 (Teams 1-4)
print("\n--- Rows 52-55 (Team Data) ---")
for idx in range(52, min(56, len(rows))):
    r = rows[idx]
    team_num = idx - 51
    print(f"\nTeam {team_num} (Row {idx+1}):")
    print(f"  Col A (cdNotYet): {r[0] if len(r)>0 else ''}")
    print(f"  Col D (colDText): {r[3] if len(r)>3 else ''}")
    print(f"  Col F (waitCD):   {r[5] if len(r)>5 else ''}")
    print(f"  Col G (fotClose): {r[6] if len(r)>6 else ''}")
    print(f"  Col H (rank):     {r[7] if len(r)>7 else ''}")
    print(f"  Col I (pct):      {r[8] if len(r)>8 else ''}")
    print(f"  Col J (d2):       {r[9] if len(r)>9 else ''}")
    print(f"  Col K (d1):       {r[10] if len(r)>10 else ''}")
    print(f"  Col L (d0):       {r[11] if len(r)>11 else ''}")
    print(f"  Col M (planM):    {r[12] if len(r)>12 else ''}")
    print(f"  Col N (overdueF): {r[13] if len(r)>13 else ''}")
    print(f"  Col P (remainWO): {r[15] if len(r)>15 else ''}")
