import sys
import os
import asyncio
from dotenv import load_dotenv

# Thêm thư mục gốc vào python path để import
sys.path.append(os.path.abspath("."))

load_dotenv()

# Import module daily_plan_report
import daily_plan_report

# Mock hàm send_msg
async def mock_send_msg(bot, cid, text, label=""):
    print(f"\n==================================================")
    print(f"MOCK TELEGRAM SEND TO CHAT {cid} (Label: {label}):")
    print(f"==================================================")
    print(text)
    print(f"==================================================\n")
    return True, [12345]

# Mock hàm delete_old_messages_bot để không gọi API
def mock_delete_old_messages_bot(token, chat_id, script_url, delete_key):
    # print(f"Mock delete old messages for chat_id {chat_id}, key: {delete_key}")
    pass

# Gắn đè hàm mock
daily_plan_report.send_msg = mock_send_msg
daily_plan_report.delete_old_messages_bot = mock_delete_old_messages_bot

async def run_test():
    # Sử dụng ngày hôm qua 08/07/2026 vì đã có dữ liệu mẫu hoàn chỉnh
    date_str = "08/07/2026"
    print(f"Running EOD report test for date: {date_str}")
    
    # Ghi đè hàm lấy ngày trong daily_plan_report
    def mock_myanmar_now():
        from datetime import datetime
        from daily_plan_report import MYANMAR_TZ
        # Myanmar time: 2026-07-08 17:30:00 (EOD report time)
        return datetime(2026, 7, 8, 17, 30, tzinfo=MYANMAR_TZ)
    
    daily_plan_report.myanmar_now = mock_myanmar_now
    
    # Chạy trực tiếp hàm sinh báo cáo
    await daily_plan_report.run_eod_or_update("eod")

if __name__ == "__main__":
    asyncio.run(run_test())
