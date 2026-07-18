import pandas as pd
import requests
import io

ss_id = "1f8tw498o9xk5j4LYHDWwD_jl401cCxX-42kpLms_6J4"

def inspect_sheet(sheet_name):
    url = f"https://docs.google.com/spreadsheets/d/{ss_id}/gviz/tq?tqx=out:csv&sheet={sheet_name}"
    try:
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text))
        print(f"\n=== Sheet: {sheet_name} ===")
        print(f"Shape: {df.shape}")
        print("Columns:")
        for idx, col in enumerate(df.columns):
            print(f"  Col {chr(65+idx)} ({idx}): {col}")
        print("First 5 rows:")
        print(df.head(5).to_string())
    except Exception as e:
        print(f"Error inspecting {sheet_name}: {e}")

inspect_sheet("1. BOD Assign")
inspect_sheet("2.My control")
