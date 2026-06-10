"""
17:30 daily report script:
  1. Gửi stats tìm kiếm đến từng NHÂN VIÊN
  2. Gửi tổng hợp team đến từng ĐỘI TRƯỞNG
Chạy bởi GitHub Actions lúc 17:30 VN mỗi ngày.
"""
import asyncio, logging, os, io
import requests
import pandas as pd
from apps_script_client import call_apps_script
from datetime import datetime, timezone, timedelta
from telegram import Bot
from telegram.error import TelegramError
from telegram.request import HTTPXRequest
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

SEND_BOT_TOKEN       = os.getenv("SEND_BOT_TOKEN")
TECHNICAL_DEP_TOKEN  = os.getenv("TECHNICAL_DEP_BOT_TOKEN")   # bot 2.1 TNI DEP REPORT DAILY
APPS_SCRIPT_URL      = os.getenv("APPS_SCRIPT_URL")
TZ_MM                = timezone(timedelta(hours=6, minutes=30))
SPREADSHEET_ID       = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
GID_REPORT           = "133591305"   # sheet có D75:E87


def get_report_data() -> dict:
    """Gọi Apps Script lấy danh sách nhân viên + đội trưởng với stats."""
    if not APPS_SCRIPT_URL:
        logger.error("Không có APPS_SCRIPT_URL trong .env!")
        return {"employees": [], "leaders": [], "managers": [], "teamSummary": [], "grandTotal": {}}
    try:
        data = call_apps_script(
            APPS_SCRIPT_URL,
            {"action": "get_report_data"},
            timeout=120,
        )
        if data.get("status") == "ok":
            # Lọc bỏ row không hợp lệ (tên là date string hoặc rỗng)
            def valid_name(n):
                return bool(n) and not n.startswith("Thu ") and not n.startswith("Mon ") \
                       and not n.startswith("Tue ") and not n.startswith("Wed ") \
                       and not n.startswith("Fri ") and not n.startswith("Sat ") \
                       and not n.startswith("Sun ") and "GMT" not in n
            data["employees"] = [e for e in data.get("employees",[]) if valid_name(e.get("name",""))]
            logger.info(
                f"✅ get_report_data OK — "
                f"{len(data['employees'])} nhân viên, "
                f"{len(data.get('leaders',[]))} đội trưởng, "
                f"{len(data.get('managers',[]))} quản lý"
            )
            return data
        else:
            logger.error(f"Apps Script lỗi: {data.get('message')}")
            return {"employees": [], "leaders": [], "managers": [], "teamSummary": [], "grandTotal": {}}
    except Exception as e:
        logger.error(f"Lỗi khi gọi get_report_data: {e}")
        return {"employees": [], "leaders": []}


def get_asset_stats() -> dict:
    """Gọi Apps Script lấy thống kê asset theo team."""
    if not APPS_SCRIPT_URL:
        return {}
    try:
        data = call_apps_script(
            APPS_SCRIPT_URL,
            {"action": "get_asset_stats"},
            timeout=120,
        )
        if data.get("status") == "ok":
            logger.info(
                f"✅ get_asset_stats OK — "
                f"{len(data.get('actionTypes',[]))} loại, "
                f"{len(data.get('recipients',[]))} người nhận"
            )
            return data
        else:
            logger.error(f"get_asset_stats lỗi: {data.get('message')}")
            return {}
    except Exception as e:
        logger.error(f"Lỗi khi gọi get_asset_stats: {e}")
        return {}


def get_custom_messages() -> list:
    """
    Đọc rows 75-87 từ sheet gid=133591305 bằng CSV export (KHÔNG dùng gviz/tq).
    ⚠️ gviz/tq bỏ hàng trống rows 56-61 → offset bị lệch → đọc sai row!
    Dùng /export?format=csv để giữ đúng số hàng (kể cả hàng trống).
    Cột D (index 3) = nội dung | Cột E (index 4) = Chat ID Telegram
    Trả về list [{content, chat_id}, ...] chỉ những dòng có đủ cả 2 giá trị.
    """
    HEADER_ROWS = 3  # rows 1-3 là header (giống cron_send.py)
    ROW_START   = 75  # bắt đầu từ row 75 (1-indexed)
    ROW_END     = 87  # đến row 87 (1-indexed, inclusive)
    COL_D       = 3   # index 0-based
    COL_E       = 4

    try:
        url = (
            f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
            f"/export?format=csv&gid={GID_REPORT}"
        )
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        resp.raise_for_status()

        df = pd.read_csv(
            io.StringIO(resp.text),
            header=None,
            dtype=str,
            on_bad_lines="skip",
        )

        messages = []
        for idx, row in df.iterrows():
            sheet_row = idx + 1  # 1-indexed
            if sheet_row < ROW_START or sheet_row > ROW_END:
                continue

            try:
                content = str(row.iloc[COL_D]).strip()
                chat_id = str(row.iloc[COL_E]).strip()
            except Exception:
                continue

            if content.lower() in ("", "nan", "none"):
                continue
            chat_id = chat_id.replace(".0", "").strip()
            if not chat_id or chat_id.lower() in ("nan", "none", ""):
                continue
            if not chat_id.lstrip("-").isdigit():
                continue

            messages.append({"content": content, "chat_id": chat_id})

        logger.info(f"✅ get_custom_messages: đọc được {len(messages)} dòng hợp lệ (rows {ROW_START}-{ROW_END})")
        return messages
    except Exception as e:
        logger.error(f"❌ get_custom_messages error: {e}")
        return []


async def main():
    if not SEND_BOT_TOKEN:
        raise RuntimeError("❌ Thiếu SEND_BOT_TOKEN trong .env!")

    now_vn = datetime.now(TZ_MM).strftime("%d/%m/%Y %H:%M")
    logger.info(f"🚀 Bắt đầu gửi báo cáo 17:30 – {now_vn}")

    # Retry get_report_data tối đa 3 lần
    data = {}
    for attempt in range(1, 4):
        data = get_report_data()
        if data.get("employees"):   # list có ít nhất 1 phần tử = thành công
            break
        logger.warning(f"⚠️ get_report_data trống lần {attempt}, thử lại sau 15s...")
        await asyncio.sleep(15)

    employees = data.get("employees", [])
    leaders   = data.get("leaders",   [])
    managers  = data.get("managers",  [])
    team_summary = data.get("teamSummary", [])
    grand     = data.get("grandTotal", {"today":0,"d1":0,"d2":0,"week":0,"month":0})

    # Tạo Bot với timeout dài hơn (60s connect, 60s read)
    trequest = HTTPXRequest(connect_timeout=60, read_timeout=60)
    bot = Bot(token=SEND_BOT_TOKEN, request=trequest)

    # Retry init tối đa 3 lần
    for attempt in range(1, 4):
        try:
            await bot.initialize()
            logger.info("✅ Bot connected!")
            break
        except Exception as e:
            logger.warning(f"⚠️ Bot init lần {attempt} lỗi: {e}, thử lại sau 5s...")
            await asyncio.sleep(5)
    else:
        logger.error("❌ Không thể kết nối bot sau 3 lần thử!")
        return

    try:
        emp_ok = emp_fail = emp_skip = 0
        ld_ok  = ld_fail  = ld_skip  = 0
        mg_ok  = mg_fail  = mg_skip  = 0

        # ── 1. Gửi đến từng nhân viên ──
        logger.info(f"--- Gửi đến {len(employees)} nhân viên ---")
        for emp in employees:
            chat_id = emp.get("chat_id", "")
            if not chat_id:
                logger.warning(f"⚠️ Không có ID: {emp.get('name')}")
                emp_skip += 1
                continue

            msg = (
                f"📊 Báo cáo tìm kiếm – {now_vn}\n"
                f"👤 {emp['name']} & Time search = "
                f"Day:{emp.get('d2',0)}/{emp.get('d1',0)}/{emp.get('today',0)} "
                f"& Week:{emp.get('week',0)} & Month:{emp.get('month',0)}"
            )
            try:
                await bot.send_message(chat_id=chat_id, text=msg)
                logger.info(f"✅ → {emp['name']} ({chat_id})")
                emp_ok += 1
            except TelegramError as e:
                logger.error(f"❌ → {emp['name']}: {e}")
                emp_fail += 1
            await asyncio.sleep(0.3)

        # ── 2. Gửi tổng hợp team đến đội trưởng ──
        logger.info(f"--- Gửi đến {len(leaders)} đội trưởng ---")
        for ld in leaders:
            chat_id = ld.get("chat_id", "")
            if not chat_id:
                logger.warning(f"⚠️ Không có ID đội trưởng: {ld.get('name')} [{ld.get('team')}]")
                ld_skip += 1
                continue

            msg = (
                f"📋 Tổng hợp Team – {now_vn}\n"
                f"🏷️ {ld['team']}\n"
                f"👑 {ld['name']} & Team search = "
                f"Day:{ld.get('d2',0)}/{ld.get('d1',0)}/{ld.get('today',0)} "
                f"& Week:{ld.get('week',0)} & Month:{ld.get('month',0)}"
            )
            try:
                await bot.send_message(chat_id=chat_id, text=msg)
                logger.info(f"✅ TL → {ld['name']} [{ld['team']}] ({chat_id})")
                ld_ok += 1
            except TelegramError as e:
                logger.error(f"❌ TL → {ld['name']}: {e}")
                ld_fail += 1
            await asyncio.sleep(0.3)

        # ── 3. Gửi tổng hợp toàn bộ đến ban quản lý ──
        logger.info(f"--- Gửi đến {len(managers)} quản lý ---")
        if managers:
            # Tạo nội dung tổng hợp theo từng team
            team_lines = []
            for ts in team_summary:
                team_lines.append(
                    f"  • {ts['team']}: "
                    f"Day:{ts.get('d2',0)}/{ts.get('d1',0)}/{ts.get('today',0)} "
                    f"| Week:{ts.get('week',0)} | Month:{ts.get('month',0)}"
                )
            team_text = "\n".join(team_lines) if team_lines else "  (chưa có dữ liệu)"

            mgmt_msg = (
                f"📊 Báo cáo tổng hợp TNI – {now_vn}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"🔍 Thống kê tìm kiếm theo Team:\n"
                f"{team_text}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📈 Tổng toàn hệ thống:\n"
                f"  Day:{grand.get('d2',0)}/{grand.get('d1',0)}/{grand.get('today',0)} "
                f"| Week:{grand.get('week',0)} | Month:{grand.get('month',0)}"
            )

            for mg in managers:
                chat_id = mg.get("chat_id", "")
                if not chat_id:
                    logger.warning(f"⚠️ Không có ID quản lý: {mg.get('role')} {mg.get('name')}")
                    mg_skip += 1
                    continue

                # ── Build management message ──
                # Part 1: Search stats by team
                team_lines = []
                for ts in team_summary:
                    team_lines.append(
                        f"  • {ts['team']}: "
                        f"Day:{ts.get('d2',0)}/{ts.get('d1',0)}/{ts.get('today',0)} "
                        f"| Week:{ts.get('week',0)} | Month:{ts.get('month',0)}"
                    )
                team_text = "\n".join(team_lines) if team_lines else "  (chưa có dữ liệu)"

                # Part 2: Team leader report content (col D)
                ld_content_lines = []
                for ld in leaders:
                    name    = ld.get("name", "")
                    team    = ld.get("team", "")
                    content = (ld.get("content") or "").strip()
                    if content:
                        # Truncate nếu quá dài
                        short = content[:600] + "..." if len(content) > 600 else content
                        ld_content_lines.append(f"👑 {name} [{team}]:\n{short}")
                ld_text = "\n\n".join(ld_content_lines) if ld_content_lines else "  (chưa có báo cáo)"

                mgmt_msg = (
                    f"📊 Báo cáo tổng hợp TNI – {now_vn}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"🔍 Tìm kiếm theo Team:\n"
                    f"{team_text}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"📈 Tổng toàn hệ thống:\n"
                    f"  Day:{grand.get('d2',0)}/{grand.get('d1',0)}/{grand.get('today',0)} "
                    f"| Week:{grand.get('week',0)} | Month:{grand.get('month',0)}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"📋 Báo cáo đội trưởng:\n"
                    f"{ld_text}"
                )

                # Nếu message quá dài (>4096), tách 2 phần
                MAX = 4000
                if len(mgmt_msg) <= MAX:
                    msgs_to_send = [mgmt_msg]
                else:
                    part1 = (
                        f"📊 Báo cáo tổng hợp TNI – {now_vn}\n"
                        f"━━━━━━━━━━━━━━━━━━━━\n"
                        f"🔍 Tìm kiếm theo Team:\n{team_text}\n"
                        f"━━━━━━━━━━━━━━━━━━━━\n"
                        f"📈 Tổng: Day:{grand.get('d2',0)}/{grand.get('d1',0)}/{grand.get('today',0)} "
                        f"| Week:{grand.get('week',0)} | Month:{grand.get('month',0)}"
                    )
                    part2 = f"📋 Báo cáo đội trưởng:\n{ld_text}"
                    msgs_to_send = [part1, part2]

                try:
                    for part in msgs_to_send:
                        await bot.send_message(chat_id=chat_id, text=part)
                        await asyncio.sleep(0.3)
                    logger.info(f"✅ MGT → {mg.get('role')} {mg.get('name')} ({chat_id})")
                    mg_ok += 1
                except TelegramError as e:
                    logger.error(f"❌ MGT → {mg.get('role')}: {e}")
                    mg_fail += 1

        logger.info(
            f"📊 Kết quả:\n"
            f"  Nhân viên:  ✅{emp_ok} | ❌{emp_fail} | ⚠️{emp_skip} không có ID\n"
            f"  Đội trưởng: ✅{ld_ok}  | ❌{ld_fail}  | ⚠️{ld_skip} không có ID\n"
            f"  Quản lý:    ✅{mg_ok}  | ❌{mg_fail}  | ⚠️{mg_skip} không có ID"
        )

        # ── 4. Gửi thống kê Asset đến Technical Dept (rows 75-87) ──
        logger.info("--- Gửi thống kê Asset → Technical Dept (rows 75-87) ---")
        asset_data = get_asset_stats()
        if asset_data.get("actionTypes"):
            action_types = asset_data.get("actionTypes", [])
            teams        = asset_data.get("teams", [])
            stats        = asset_data.get("stats", {})
            grand        = asset_data.get("grandTotal", {})

            TEAM_SHORT = {
                "MYT_TNI_TEAM01_Dawei":      "Team1(Dawei)",
                "MYT_TNI_TEAM02_Myeik":      "Team2(Myeik)",
                "MYT_TNI_TEAM03_Bokpyin":    "Team3(Bokpyin)",
                "MYT_TNI_TEAM04_Kawthoung":  "Team4(Kawthoung)",
            }

            def fmt_stat(s):
                return (
                    f"T:{s.get('total',0)} Done:{s.get('done',0)} | "
                    f"Day:{s.get('d0',0)}/{s.get('d1',0)}/{s.get('d2',0)} "
                    f"Week:{s.get('d6',0)} Month:{s.get('d15',0)} "
                    f"(Done:{s.get('done_d0',0)}/{s.get('done_d1',0)}/{s.get('done_d2',0)}/"
                    f"{s.get('done_d6',0)}/{s.get('done_d15',0)})"
                )

            lines = [f"📦 Thống kê Asset – {now_vn}", "━━━━━━━━━━━━━━━━━━━━"]
            lines.append("📅 Format: Total | Day:hôm nay/hôm qua/2ngày Week Month (Done)")

            for tm in teams:
                tm_short = TEAM_SHORT.get(tm, tm)
                lines.append(f"\n🏷️ {tm_short}:")
                for at in action_types:
                    s = stats.get(at, {}).get(tm, {})
                    if s.get("total", 0) > 0:
                        lines.append(f"  {at}: {fmt_stat(s)}")
                    else:
                        lines.append(f"  {at}: —")

            lines.append("\n━━━━━━━━━━━━━━━━━━━━")
            lines.append("📊 Total tất cả team:")
            for at in action_types:
                g = grand.get(at, {})
                lines.append(f"  {at}: {fmt_stat(g)}")

            asset_msg = "\n".join(lines)

            # Lấy chat_ids Technical Dept từ rows 75-87 col E (giống get_custom_messages)
            tech_dept_ids = list({
                item["chat_id"] for item in get_custom_messages()
                if item.get("chat_id")
            })
            logger.info(f"  Technical Dept IDs: {tech_dept_ids}")

            # Gửi qua TECHNICAL_DEP_BOT (@TNITECHINICALDEPREPORT_BOT)
            asset_ok = asset_fail = 0
            if TECHNICAL_DEP_TOKEN and tech_dept_ids:
                dep_bot = Bot(token=TECHNICAL_DEP_TOKEN, request=trequest)
                await dep_bot.initialize()
                for rcpt_id in tech_dept_ids:
                    try:
                        await dep_bot.send_message(chat_id=rcpt_id, text=asset_msg)
                        logger.info(f"✅ Asset(DEP_BOT) → {rcpt_id}")
                        asset_ok += 1
                    except TelegramError as e:
                        logger.error(f"❌ Asset(DEP_BOT) → {rcpt_id}: {e}")
                        asset_fail += 1
                    await asyncio.sleep(0.3)
                await dep_bot.shutdown()
            else:
                logger.warning("⚠️ Không có TECHNICAL_DEP_BOT_TOKEN hoặc không có Technical Dept IDs")

            logger.info(f"  Asset stats: ✅{asset_ok} | ❌{asset_fail}")
        else:
            logger.warning("⚠️ Không lấy được asset stats (bỏ qua)")

        # ── 5. Gửi tin nhắn tùy chỉnh từ D75:E87 ──
        logger.info("--- Gửi tin nhắn tùy chỉnh D75:E87 ---")
        custom_msgs = get_custom_messages()
        cust_ok = cust_fail = 0
        for item in custom_msgs:
            chat_id = item["chat_id"]
            content = item["content"]
            try:
                await bot.send_message(chat_id=chat_id, text=content)
                logger.info(f"✅ Custom → {chat_id}: {content[:40]}...")
                cust_ok += 1
            except TelegramError as e:
                logger.error(f"❌ Custom → {chat_id}: {e}")
                cust_fail += 1
            await asyncio.sleep(0.3)
        logger.info(f"  Custom msgs: ✅{cust_ok} | ❌{cust_fail} | Tổng:{len(custom_msgs)}")

    finally:
        await bot.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
