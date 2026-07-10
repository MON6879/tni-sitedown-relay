import sys
import asyncio
from datetime import datetime, timedelta, timezone
from telethon import TelegramClient
from telethon.sessions import StringSession
import os
import re

# Load .env manually
env = {}
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()

API_ID = int(env.get("TELEGRAM_API_ID", 0))
API_HASH = env.get("TELEGRAM_API_HASH", "")
SESSION_STRING = env.get("TELEGRAM_SESSION", "")

GROUPS = {
    "T1": -5180992881,
    "T2": -5188855349,
    "T3": -5183480727
}

# Emulate get_team_leaders
import requests
import io
import pandas as pd

TEAM_SHEET_URL = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/gviz/tq?tqx=out:csv&gid=133591305"
def get_team_leaders():
    leaders = {}
    try:
        resp = requests.get(TEAM_SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
        
        for idx in range(3, min(len(df), 59)):
            row = df.iloc[idx]
            team = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ""
            username = str(row.iloc[2]).strip() if not pd.isna(row.iloc[2]) else ""
            tg_id = str(row.iloc[4]).strip() if len(row) > 4 and not pd.isna(row.iloc[4]) else ""
            if tg_id.endswith(".0"): tg_id = tg_id[:-2]
            
            if "leader" in username.lower():
                tk = team.upper()
                if "TEAM01" in tk or "TEAM1" in tk: tk = "T1"
                elif "TEAM02" in tk or "TEAM2" in tk or "TEAM05" in tk or "TEAM5" in tk: tk = "T2"
                elif "TEAM03" in tk or "TEAM3" in tk: tk = "T3"
                elif "TEAM04" in tk or "TEAM4" in tk: tk = "T4"
                else: tk = ""
                if tk:
                    leaders[tk] = tg_id
    except Exception as e:
        print("Error reading leaders:", e)
    
    fallback = {"T1": "6859790680", "T2": "6555381983", "T3": "6710667362", "T4": "6867087612"}
    for k, v in fallback.items():
        leaders.setdefault(k, v)
    return leaders

def is_daily_plan_msg(text: str) -> bool:
    if not text:
        return False
    first_line = text.strip().split("\n")[0].lower()
    has_plan_word = "plan" in first_line
    has_date = bool(re.search(r'\d{1,2}/\d{1,2}/\d{2,4}', text))
    return has_plan_word and has_date

async def main():
    leaders = get_team_leaders()
    print("Registered Leaders:", leaders)
    
    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)
    async with client:
        for group_key, chat_id in GROUPS.items():
            print(f"\n--- Scanning Group {group_key} (ID: {chat_id}) ---")
            entity = await client.get_input_entity(chat_id)
            leader_id = leaders.get(group_key)
            
            async for msg in client.iter_messages(entity, limit=40):
                if not msg.message:
                    continue
                
                # Check if message contains "plan" or "daily plan"
                msg_lower = msg.message.lower()
                is_plan = "plan" in msg_lower
                
                if is_plan:
                    sender = await msg.get_sender()
                    sender_name = getattr(sender, 'first_name', '')
                    if getattr(sender, 'last_name', ''):
                        sender_name += ' ' + sender.last_name
                    username = getattr(sender, 'username', '')
                    
                    sender_id = msg.sender_id
                    match_leader = str(sender_id) == str(leader_id)
                    matched_parser = is_daily_plan_msg(msg.message)
                    
                    # Check if it was sent by a bot to skip self-reports
                    is_bot = getattr(sender, 'bot', False)
                    if is_bot:
                        continue
                        
                    print(f"\n[POTENTIAL PLAN FOUND]")
                    print(f"Msg ID: {msg.id}")
                    print(f"Date: {msg.date.astimezone(timezone(timedelta(hours=6, minutes=30)))} (Myanmar)")
                    print(f"Sender: {sender_name} (ID: {sender_id}, Username: @{username})")
                    print(f"Is Registered Leader ({leader_id})? {'YES' if match_leader else 'NO'}")
                    print(f"Matched Parser? {'YES' if matched_parser else 'NO'}")
                    print(f"Text Preview: {repr(msg.message[:200])}")

if __name__ == "__main__":
    asyncio.run(main())
