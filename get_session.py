"""
get_session.py
==============
Chạy 1 LẦN DUY NHẤT trên máy tính cá nhân để tạo Session String.
Sau đó copy chuỗi đó vào GitHub Secret: TELEGRAM_SESSION

Cách chạy:
    pip install telethon
    python get_session.py
"""

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

API_ID   = 38060453
API_HASH = "49dbb07f2d226a968571b11eab076d73"

print("=" * 55)
print("  Tạo Telegram Session String")
print("=" * 55)
print()

with TelegramClient(StringSession(), API_ID, API_HASH) as client:
    session_str = client.session.save()

print()
print("=" * 55)
print("✅ SESSION STRING CỦA BẠN:")
print("=" * 55)
print()
print(session_str)
print()
print("=" * 55)
print("📋 COPY chuỗi trên và dán vào GitHub Secret:")
print("   Tên secret: TELEGRAM_SESSION")
print("=" * 55)
