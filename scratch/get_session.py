"""
get_session.py
==============
Chạy 1 LẦN DUY NHẤT trên máy tính cá nhân để tạo Session String.
Sau đó copy chuỗi đó vào GitHub Secret: TELEGRAM_SESSION

Cách chạy:
    pip install telethon
    python scratch/get_session.py
"""

import subprocess
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

# Ghi ra file session_result.txt
output_file = "session_result.txt"
with open(output_file, "w", encoding="utf-8") as f:
    f.write(session_str)

# Tự động copy vào Clipboard (Windows)
try:
    subprocess.run(["clip"], input=session_str.encode("utf-8"), check=True)
    clipboard_msg = "✅ ĐÃ TỰ ĐỘNG COPY VÀO CLIPBOARD (Bạn chỉ cần Ctrl + V để Dán)!"
except Exception:
    clipboard_msg = ""

print()
print("=" * 55)
print("✅ SESSION STRING CỦA BẠN DƯỚI ĐÂY:")
print("=" * 55)
print()
print(session_str)
print()
print("=" * 55)
if clipboard_msg:
    print(clipboard_msg)
print(f"📁 Chuỗi Session cũng đã được LƯU VÀO FILE: {output_file}")
print("📋 Bạn có thể mở file session_result.txt để copy dễ dàng!")
print("=" * 55)
