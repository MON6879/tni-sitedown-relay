import asyncio
import os
import sys
sys.path.append('.')
from telethon import TelegramClient
from telethon.sessions import StringSession
from cron_send import TELEGRAM_API_ID, TELEGRAM_API_HASH

new_session_str = "1BVtsOJgBuzhY3aktGh7ckeh_99sio04AfQfwse7TaD0DShwbGBmNbdbvvdd1aHYj6AC23-AY29uLxzVxEtNQHOTagJsVk5-q-E7khML2l4mA7cOABrtb7RTCpasvEZ4WLuOjx3FNvN1AVgmE--E5GA0_eZ7sd4DWP_9O4QOvp_6SaCRprV3HwD-UW357h9AoqLVGl7HD2msqXW00ZaRyW-WdelWQm80RUkX57eYARfh--fIpON8Dl8U2MJcD9b7VZuFdSCb9f5_KLcuDFmMxAG5Nh5OoPFNHeNQkF-8XuKFTTUga68M6Req5fEaz288JYwnRcCaE7wcvaFUBXyKEo17tQcndvls="

async def test_new_session():
    print("Testing New Session string from NEW_SESSION.txt...")
    try:
        client = TelegramClient(StringSession(new_session_str), int(TELEGRAM_API_ID), TELEGRAM_API_HASH)
        await client.connect()
        authorized = await client.is_user_authorized()
        print(f"Is user authorized: {authorized}")
        if authorized:
            me = await client.get_me()
            print(f"✅ Authorized as: {me.first_name} (@{me.username}) ID: {me.id}")
        else:
            print("❌ Unauthorized")
        await client.disconnect()
    except Exception as ex:
        print("❌ Connection error:", ex)

asyncio.run(test_new_session())
