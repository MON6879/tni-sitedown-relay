import asyncio
import os
import sys
sys.path.append('.')
from telethon import TelegramClient
from telethon.sessions import StringSession
from cron_send import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION

async def test_session():
    print("Testing Telethon Session...")
    try:
        client = TelegramClient(StringSession(TELEGRAM_SESSION), int(TELEGRAM_API_ID), TELEGRAM_API_HASH)
        await client.connect()
        authorized = await client.is_user_authorized()
        print(f"Is user authorized: {authorized}")
        if authorized:
            me = await client.get_me()
            print(f"Me: {me.first_name} (@{me.username}) ID: {me.id} Restricted: {me.restricted}")
            # Try getting dialogs / checking chat access
            dialogs = await client.get_dialogs(limit=5)
            print(f"Successfully fetched {len(dialogs)} dialogs!")
        else:
            print("❌ USER IS NOT AUTHORIZED (Session Expired or Terminated by Telegram)")
        await client.disconnect()
    except Exception as ex:
        print("❌ Telethon Error:", type(ex).__name__, ex)

asyncio.run(test_session())
