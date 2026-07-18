"""
Xóa thủ công tất cả tin cũ đang tích tụ trong các team group.
Chạy 1 lần sau khi đã update APPS_SCRIPT_URL lên v222.
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
from delete_old_helper import delete_old_messages_bot

load_dotenv()
BOT_TOKEN  = os.getenv("COLLECTOR_BOT_TOKEN", "")  # hoặc SEND_BOT_TOKEN
GAS_URL    = os.getenv("APPS_SCRIPT_URL", "")

TEAMS = {
    "T1": "-5180992881",
    "T2": "-5188855349",
    "T3": "-5183480727",
    "T4": "-5238696719",
}
CONTROL = "-5251698940"

KEYS = {
    "-5180992881": ["CRON_TEAM_T1", "CRON_TEAM_T1_FULL"],
    "-5188855349": ["CRON_TEAM_T2", "CRON_TEAM_T2_FULL"],
    "-5183480727": ["CRON_TEAM_T3", "CRON_TEAM_T3_FULL"],
    "-5238696719": ["CRON_TEAM_T4", "CRON_TEAM_T4_FULL"],
    CONTROL:       ["CRON_TECHDEP_CONTROL", "CRON_TECHDEP_DETAIL", "CRON_EOD_CONTROL"],
}

print(f"Using URL: {GAS_URL[:80]}...")
print(f"Bot token: {BOT_TOKEN[:20]}...\n")

total = 0
for cid, keys in KEYS.items():
    for key in keys:
        n = delete_old_messages_bot(BOT_TOKEN, cid, GAS_URL, key)
        if n:
            print(f"  ✅ Xóa {n} tin: {key} → {cid}")
            total += n

print(f"\n🗑️ Tổng xóa: {total} tin nhắn")
