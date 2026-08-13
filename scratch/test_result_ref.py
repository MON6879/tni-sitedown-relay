import requests
import re

def fetch_max_result_ref() -> str:
    SPREADSHEET_ID_NEW = "1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y"
    csv_url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID_NEW}/gviz/tq?tqx=out:csv&gid=2037920194"
    try:
        r = requests.get(csv_url, timeout=10)
        if r.status_code == 200:
            max_num = 0
            for line in r.text.splitlines()[1:]:
                parts = line.split(",")
                if parts:
                    clean = parts[0].replace('"', '').strip()
                    if clean.isdigit():
                        val = int(clean)
                        if val > max_num:
                            max_num = val
            if max_num > 0:
                return str(max_num + 1)
    except Exception as e:
        print("fetch_max_result_ref error:", e)
    return "265"

ref = fetch_max_result_ref()
print("Calculated next Daily Result REF:", ref)
