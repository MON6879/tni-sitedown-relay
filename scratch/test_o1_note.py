import requests
import csv
import io

def get_control_note_from_sheet() -> str:
    # First: Try fetching cell O1 from Refuel Sheet (gid=201295323)
    refuel_note_url = "https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/gviz/tq?tqx=out:csv&gid=201295323"
    try:
        resp = requests.get(refuel_note_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        if resp.status_code == 200:
            reader = list(csv.reader(io.StringIO(resp.text)))
            if reader and len(reader[0]) > 14:
                val = reader[0][14].strip()
                if val and val.lower() not in ("nan", "none", ""):
                    return val
    except Exception as e:
        print(f"Warning fetching O1 note: {e}")
    return ""

note = get_control_note_from_sheet()
print("Fetched Note from Cell O1:")
print(note)
