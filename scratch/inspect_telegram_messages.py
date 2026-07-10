import sys
import asyncio
from datetime import datetime, timedelta, timezone
from telethon import TelegramClient
from telethon.sessions import StringSession
import os

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

T4_CHAT_ID = -5238696719

async def main():
    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)
    async with client:
        print("Logged in successfully.")
        
        # Scan last 20 messages in T4
        entity = await client.get_input_entity(T4_CHAT_ID)
        print(f"Scanning T4 group: {T4_CHAT_ID}")
        
        async for msg in client.iter_messages(entity, limit=20):
            sender = await msg.get_sender()
            sender_name = getattr(sender, 'first_name', '')
            if getattr(sender, 'last_name', ''):
                sender_name += ' ' + sender.last_name
            username = getattr(sender, 'username', '')
            
            print(f"\nMsg ID: {msg.id}")
            print(f"Date: {msg.date} (Myanmar: {msg.date.astimezone(timezone(timedelta(hours=6, minutes=30)))})")
            print(f"Sender: {sender_name} (ID: {msg.sender_id}, Username: @{username})")
            print(f"Text preview: {repr(msg.message[:150] if msg.message else '')}")

if __name__ == "__main__":
    asyncio.run(main())
