import io, json, os, time
import requests
import pandas as pd

SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
BASE_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid="
GID_INFO     = "171059303"
GID_TEAM_SUM = "893574714"

def safe(row, i):
    try:
        v = row.iloc[i]
        return "" if pd.isna(v) else str(v).strip()
    except:
        return ""

def fetch(gid):
    url = BASE_URL + gid
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20, allow_redirects=True)
    r.raise_for_status()
    return pd.read_csv(io.StringIO(r.content.decode("utf-8", "replace")), header=None, dtype=str, on_bad_lines="skip")

print("Fetching GID_INFO...")
df_info = fetch(GID_INFO)
print(f"  GID_INFO: {len(df_info)} rows")

print("Fetching GID_TEAM_SUM...")
df_team = fetch(GID_TEAM_SUM)
print(f"  GID_TEAM_SUM: {len(df_team)} rows")

# Build info index
info_idx = {}
for _, row in (df_info.iloc[1:] if len(df_info) > 1 else df_info).iterrows():
    col_a = safe(row, 0).upper().strip()
    if not col_a:
        continue
    code_part = col_a.split(":")[0].strip()
    info_idx[code_part] = {
        "site":  safe(row, 1),
        "cable": safe(row, 2),
        "gpon":  safe(row, 3),
        "dia":   safe(row, 4),
    }

# Build team summary index
team_idx = {}
for _, row in df_team.iterrows():
    col_b = safe(row, 1).strip().upper()
    if not col_b:
        continue
    col_h = safe(row, 7)
    if col_h:
        team_idx[col_b] = col_h.strip().lstrip("~ ").strip()

cache = {
    "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "info":     info_idx,
    "team":     team_idx,
}

out_path = os.path.join(os.path.dirname(__file__), "api", "data_cache.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(cache, f, ensure_ascii=False, separators=(",", ":"))

print(f"Saved: {out_path}")
print(f"  info codes: {len(info_idx)}")
print(f"  team codes: {len(team_idx)}")
print(f"  file size:  {os.path.getsize(out_path)/1024:.1f} KB")
