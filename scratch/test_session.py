import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = 38060453
API_HASH = "49dbb07f2d226a968571b11eab076d73"
with open("tni_site_down_repo/NEW_SESSION.txt", "r", encoding="utf-8") as f:
    SESSION_STR = f.read().strip()

async def test():
    client = TelegramClient(StringSession(SESSION_STR), API_ID, API_HASH)
    try:
        await client.connect()
        if not await client.is_user_authorized():
            print("❌ Session is NOT authorized!")
        else:
            me = await client.get_me()
            print(f"✅ SUCCESS! Authorized as @{me.username} ({me.first_name} {me.last_name or ''}) Phone: +{me.phone}")
        await client.disconnect()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
