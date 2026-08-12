import asyncio
import os
import requests
from telethon import TelegramClient
from telethon.sessions import StringSession

import sys
sys.path.append('.')
from cron_send import SEND_BOT_TOKEN, TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION

print("--- 1. Testing Telegram Bot API ---")
try:
    r = requests.get(f"https://api.telegram.org/bot{SEND_BOT_TOKEN}/getMe", timeout=10)
    print("Bot API response:", r.json())
except Exception as e:
    print("Bot API error:", e)

print("\n--- 2. Testing Telethon User Account (@phongha79) ---")
async def check_telethon():
    if not TELEGRAM_SESSION or not TELEGRAM_API_ID or not TELEGRAM_API_HASH:
        print("Missing Telethon credentials!")
        return
    try:
        client = TelegramClient(StringSession(TELEGRAM_SESSION), int(TELEGRAM_API_ID), TELEGRAM_API_HASH)
        await client.connect()
        if not await client.is_user_authorized():
            print("❌ Telethon Session UNAUTHORIZED / EXPIRED / BANNED!")
        else:
            me = await client.get_me()
            print(f"✅ Telethon Authorized! Connected as: {me.first_name} (@{me.username}) ID: {me.id}")
        await client.disconnect()
    except Exception as ex:
        print("❌ Telethon Connection error:", ex)

asyncio.run(check_telethon())
