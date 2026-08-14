"""
Mô phỏng CHÍNH XÁC môi trường GitHub Actions của MON6879/tni-sitedown-relay
Khi secrets KHÔNG được set (empty string), Python sẽ crash như thế nào?
"""
import os

# Mô phỏng: secrets KHÔNG được set -> os.environ.get returns ""
os.environ["TELEGRAM_API_ID"] = ""     # Simulate empty secret
os.environ["TELEGRAM_API_HASH"] = ""
os.environ["TELEGRAM_SESSION"] = ""

# Dòng code gốc trong botlookup_relay.py dòng 24:
try:
    API_ID = int(os.environ.get("TELEGRAM_API_ID", "0"))
    print(f"API_ID = {API_ID}")  # Would be 0 if default used
except ValueError as e:
    print(f"❌ CRASH! ValueError: {e}")
    print("-> NGUYÊN NHÂN: TELEGRAM_API_ID secret KHÔNG được set trong repo MON6879/tni-sitedown-relay!")

# Dòng code gốc dòng 24 với environ.get("TELEGRAM_API_ID") = ""
# int("") -> ValueError: invalid literal for int() with base 10: ''
try:
    API_ID2 = int(os.environ["TELEGRAM_API_ID"])
    print(f"API_ID2 = {API_ID2}")
except (ValueError, KeyError) as e:
    print(f"❌ CRASH! {type(e).__name__}: {e}")
