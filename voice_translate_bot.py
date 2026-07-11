"""
voice_translate_bot.py
======================
Bot Telegram mới: Dịch voice tiếng Việt → English + Đọc/tìm tin nhắn group.

Tính năng:
  1. Gửi voice message tiếng Việt → STT (Whisper) → Translate → Gửi đến group/cá nhân
  2. /read <group> [N]  → Đọc N tin nhắn mới nhất từ group
  3. /search <group|all> <keyword> → Tìm tin nhắn theo keyword
  4. /target <group>    → Chọn group đích để gửi bản dịch
  5. /lang <vi-en|en-vi> → Chọn hướng dịch

Chạy:
    pip install python-telegram-bot==21.9 openai deep-translator telethon python-dotenv pytz
    python voice_translate_bot.py

Yêu cầu .env:
    VOICE_BOT_TOKEN=...
    OPENAI_API_KEY=...
    TELEGRAM_API_ID=...
    TELEGRAM_API_HASH=...
    TELEGRAM_SESSION=...
"""

import os
import asyncio
import tempfile
import logging
import html
from datetime import datetime, timedelta

import pytz
from dotenv import load_dotenv
from openai import OpenAI
from deep_translator import GoogleTranslator

from telegram import Update, Bot
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import GetHistoryRequest

# ─── Logging ───────────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("VoiceBot")

# ─── Load .env ─────────────────────────────────────────────
load_dotenv()

VOICE_BOT_TOKEN   = os.getenv("VOICE_BOT_TOKEN", "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")
TELEGRAM_API_ID   = int(os.getenv("TELEGRAM_API_ID", "38060453"))
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "49dbb07f2d226a968571b11eab076d73")
TELEGRAM_SESSION  = os.getenv("TELEGRAM_SESSION", "")

# ─── OpenAI client ─────────────────────────────────────────
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# ─── Group mapping ─────────────────────────────────────────
from tni_config import TELEGRAM_GROUPS as GROUP_MAP

# ─── Per-user settings (in-memory) ─────────────────────────
user_settings = {}   # user_id -> { "target": chat_id, "lang": "vi-en" }
translation_history = {}  # user_id -> [ { "original", "translated", "time" } ]

MYANMAR_TZ = pytz.timezone("Asia/Yangon")

# ─── Language pairs ────────────────────────────────────────
LANG_PAIRS = {
    "vi-en": ("vi", "en", "Vietnamese → English"),
    "en-vi": ("en", "vi", "English → Vietnamese"),
    "vi-my": ("vi", "my", "Vietnamese → Myanmar"),
    "my-vi": ("my", "vi", "Myanmar → Vietnamese"),
    "my-en": ("my", "en", "Myanmar → English"),
    "en-my": ("en", "my", "English → Myanmar"),
}

# ═══════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════

def get_user_setting(user_id: int) -> dict:
    """Lấy setting của user, tạo mới nếu chưa có."""
    if user_id not in user_settings:
        user_settings[user_id] = {"target": None, "lang": "vi-en"}
    return user_settings[user_id]


def resolve_group(name: str):
    """Chuyển tên group (T1, T2, CONTROL...) thành chat_id."""
    key = name.strip().upper()
    return GROUP_MAP.get(key), key


async def get_telethon_client():
    """Tạo và kết nối Telethon client."""
    client = TelegramClient(
        StringSession(TELEGRAM_SESSION),
        TELEGRAM_API_ID,
        TELEGRAM_API_HASH,
    )
    await client.connect()
    return client


def whisper_stt(file_path: str, language: str = "vi") -> str:
    """Chuyển giọng nói → text. Dùng Google STT miễn phí (chính), Whisper (dự phòng)."""
    import speech_recognition as sr
    from pydub import AudioSegment

    # Chuyển OGG → WAV (Google STT cần WAV)
    wav_path = file_path.replace(".ogg", ".wav")
    try:
        audio = AudioSegment.from_ogg(file_path)
        audio.export(wav_path, format="wav")
    except Exception as e:
        log.warning(f"OGG→WAV conversion failed: {e}")
        # Thử dùng OpenAI Whisper nếu có API key
        if OPENAI_API_KEY:
            return _whisper_openai(file_path, language)
        raise

    try:
        # Google Speech Recognition — MIỄN PHÍ, không cần API key
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

        # Map language code cho Google
        lang_map = {"vi": "vi-VN", "en": "en-US", "my": "my-MM"}
        google_lang = lang_map.get(language, f"{language}-{language.upper()}")

        text = recognizer.recognize_google(audio_data, language=google_lang)
        log.info(f"Google STT result: {text[:100]}")
        return text.strip()

    except sr.UnknownValueError:
        log.warning("Google STT could not understand audio")
        # Fallback: thử OpenAI Whisper
        if OPENAI_API_KEY:
            return _whisper_openai(file_path, language)
        return ""
    except sr.RequestError as e:
        log.warning(f"Google STT error: {e}")
        if OPENAI_API_KEY:
            return _whisper_openai(file_path, language)
        return ""
    finally:
        try:
            os.unlink(wav_path)
        except Exception:
            pass


def _whisper_openai(file_path: str, language: str = "vi") -> str:
    """Fallback: dùng OpenAI Whisper API (cần credits)."""
    try:
        with open(file_path, "rb") as audio_file:
            transcript = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                response_format="text",
            )
        result = transcript.strip() if isinstance(transcript, str) else str(transcript).strip()
        log.info(f"Whisper STT result: {result[:100]}")
        return result
    except Exception as e:
        log.error(f"Whisper STT failed: {e}")
        return ""


def translate_text(text: str, source: str, target: str) -> str:
    """Dịch text bằng Google Translate (miễn phí)."""
    if not text:
        return ""
    translated = GoogleTranslator(source=source, target=target).translate(text)
    return translated or ""


def text_to_speech(text: str, lang: str = "vi") -> str:
    """Chuyển text → file MP3 bằng Google TTS (miễn phí).
    Returns: đường dẫn file MP3 tạm."""
    from gtts import gTTS

    # Loại bỏ emoji và ký tự đặc biệt cho TTS
    import re as _re
    clean = _re.sub(r'[🕐📋✅❌⚠️🔍📊💡🎤📝🔥💬📌🟢🔵🟡🔴•─═]', '', text)
    clean = _re.sub(r'<[^>]+>', '', clean)  # Xóa HTML tags
    clean = _re.sub(r'\s+', ' ', clean).strip()

    if not clean:
        return ""

    # Giới hạn 5000 ký tự (giới hạn gTTS)
    if len(clean) > 5000:
        clean = clean[:5000]

    tts = gTTS(text=clean, lang=lang, slow=False)
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tts.save(tmp.name)
    tmp.close()
    log.info(f"TTS generated: {tmp.name} ({len(clean)} chars)")
    return tmp.name


# ═══════════════════════════════════════════════════════════
#  BOT COMMANDS
# ═══════════════════════════════════════════════════════════

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/start — Hướng dẫn sử dụng."""
    text = (
        "🎙️ <b>TNI Voice Translate Bot</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "📌 <b>Feature 1: Voice → Translate → Send</b>\n"
        "1️⃣ <code>/target T1</code> — Pick target group\n"
        "2️⃣ Send a voice message 🎤\n"
        "3️⃣ Bot auto: Speech→Text → Translate → Send\n\n"
        "📌 <b>Feature 2: Read Messages</b>\n"
        "• <code>/read T1</code> — Last 10 messages from T1\n"
        "• <code>/read T2 20</code> — Last 20 messages from T2\n"
        "• <code>/search T1 cable</code> — Search 'cable' in T1\n"
        "• <code>/search all TNIXXXX</code> — Search all groups\n\n"
        "📌 <b>Settings</b>\n"
        "• <code>/target T1</code> — Set target: T1/T2/T3/T4/CONTROL\n"
        "• <code>/lang vi-en</code> — Set language: vi-en, en-vi, vi-my...\n"
        "• <code>/history</code> — View recent translations\n"
        "• <code>/groups</code> — List all available groups\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "🔹 <b>Groups:</b> T1 (Dawei), T2 (Myeik), T3 (Bokpyin), "
        "T4 (Kawthoung), CONTROL"
    )
    await update.message.reply_text(text, parse_mode="HTML")


async def cmd_groups(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/groups — Liệt kê các group."""
    lines = ["📋 <b>Available Groups:</b>\n"]
    labels = {
        "T1": "Dawei",
        "T2": "Myeik + Team5",
        "T3": "Bokpyin",
        "T4": "Kawthoung",
        "CONTROL": "Control (All teams)",
    }
    for key, chat_id in GROUP_MAP.items():
        label = labels.get(key, "")
        lines.append(f"  • <b>{key}</b> — {label}  (<code>{chat_id}</code>)")
    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


async def cmd_target(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/target <group> — Chọn group đích."""
    if not ctx.args:
        await update.message.reply_text(
            "⚠️ Usage: <code>/target T1</code>\n"
            "Options: T1, T2, T3, T4, CONTROL, or a chat_id number",
            parse_mode="HTML",
        )
        return

    arg = ctx.args[0]
    chat_id, key = resolve_group(arg)

    if chat_id is None:
        # Thử parse dạng số (chat_id trực tiếp)
        try:
            chat_id = int(arg)
            key = str(chat_id)
        except ValueError:
            await update.message.reply_text(
                f"❌ Unknown group: <b>{arg}</b>\n"
                "Use: T1, T2, T3, T4, CONTROL, or a chat_id number.",
                parse_mode="HTML",
            )
            return

    settings = get_user_setting(update.effective_user.id)
    settings["target"] = chat_id
    labels = {
        "T1": "Dawei", "T2": "Myeik", "T3": "Bokpyin",
        "T4": "Kawthoung", "CONTROL": "Control",
    }
    label = labels.get(key, key)
    await update.message.reply_text(
        f"✅ Target set: <b>{key}</b> ({label})\n"
        "Now send a voice message 🎤 to translate and send!",
        parse_mode="HTML",
    )


async def cmd_lang(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/lang <pair> — Chọn cặp ngôn ngữ dịch."""
    if not ctx.args:
        settings = get_user_setting(update.effective_user.id)
        current = settings["lang"]
        lines = [f"🌐 Current: <b>{current}</b>\n\nAvailable:"]
        for pair, (_, _, desc) in LANG_PAIRS.items():
            marker = " ✅" if pair == current else ""
            lines.append(f"  • <code>{pair}</code> — {desc}{marker}")
        lines.append(f"\nUsage: <code>/lang vi-en</code>")
        await update.message.reply_text("\n".join(lines), parse_mode="HTML")
        return

    pair = ctx.args[0].lower()
    if pair not in LANG_PAIRS:
        await update.message.reply_text(
            f"❌ Unknown pair: <b>{pair}</b>\n"
            f"Available: {', '.join(LANG_PAIRS.keys())}",
            parse_mode="HTML",
        )
        return

    settings = get_user_setting(update.effective_user.id)
    settings["lang"] = pair
    _, _, desc = LANG_PAIRS[pair]
    await update.message.reply_text(f"✅ Language set: <b>{desc}</b>", parse_mode="HTML")


async def cmd_history(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/history — Xem 5 bản dịch gần nhất."""
    user_id = update.effective_user.id
    history = translation_history.get(user_id, [])

    if not history:
        await update.message.reply_text("📭 No translation history yet.")
        return

    lines = ["📜 <b>Recent Translations:</b>\n"]
    for i, item in enumerate(history[-5:], 1):
        lines.append(
            f"<b>{i}.</b> 🕐 {item['time']}\n"
            f"   🎤 {item['original'][:80]}\n"
            f"   🔄 {item['translated'][:80]}\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


# ═══════════════════════════════════════════════════════════
#  VOICE COMMAND DETECTION
# ═══════════════════════════════════════════════════════════

import re

# Từ khóa để nhận diện lệnh voice tiếng Việt
# "tin" thường bị Google STT nhận nhầm từ "team" → thêm vào pattern
GROUP_WORD = r"(?:team\s*|tim\s*|tin\s*|t(?:í|i)?m\s*|t)"  # team/tim/tin/t

COMMAND_PATTERNS = {
    "read": [
        # "đọc tin nhắn team 1", "đọc team 1", "đọc t1"
        rf"đọc\s+(?:tin\s+nhắn\s+)?{GROUP_WORD}(\d|control)",
        # "đọc cho tôi báo cáo team 1"
        rf"đọc\s+(?:cho\s+(?:tôi|mình)\s+)?(?:báo\s+cáo\s+)?{GROUP_WORD}(\d|control)",
        # "xem/mở tin nhắn team 1"
        rf"(?:xem|mở)\s+(?:tin\s+nhắn\s+)?{GROUP_WORD}(\d|control)",
        # "read team 1" / "read t1"
        rf"read\s+{GROUP_WORD}(\d|control)",
        # "có gì mới trong team 1"
        rf"(?:có\s+gì\s+mới|tin\s+mới)\s+(?:trong\s+)?{GROUP_WORD}(\d|control)",
        # "tin nhắn team 1" / "tin nhắn tin 1" (không cần "đọc")
        rf"tin\s+nhắn\s+{GROUP_WORD}(\d|control)",
        # "nhắn tin team 1" / "nhắn tin 1" (đảo ngược)
        rf"nhắn\s+tin\s+{GROUP_WORD}(\d|control)",
        # "nhắn tin 1" (không có team)
        r"nhắn\s+tin\s+(\d)",
        # "team 1 có gì" / "tin 1 có gì"
        rf"{GROUP_WORD}(\d|control)\s+(?:có\s+gì|mới|nhắn)",
        # "báo cáo team 1"
        rf"báo\s+cáo\s+{GROUP_WORD}(\d|control)",
        # SIMPLE: chỉ nói "team 1" / "tin 1" / "tim 1"
        rf"^{GROUP_WORD}(\d|control)$",
        # SIMPLE: "đọc 1" / "đọc 2"
        r"^đọc\s+(\d)$",
    ],
    "search": [
        r"tìm\s+(.+?)(?:\s+trong\s+(?:team\s*|tin\s*|t)(\d|control|tất\s*cả|all))?$",
        r"search\s+(.+?)(?:\s+(?:in|trong)\s+(?:team\s*|tin\s*|t)(\d|control|all))?$",
        r"kiếm\s+(.+?)(?:\s+trong\s+(?:team\s*|tin\s*|t)(\d|control|tất\s*cả|all))?$",
    ],
    "target": [
        rf"(?:gửi\s+(?:đến|tới|vào)|chuyển\s+(?:đến|sang)|target)\s+{GROUP_WORD}(\d|control)",
        rf"(?:chọn|đặt)\s+(?:group|nhóm)\s+{GROUP_WORD}(\d|control)",
    ],
    "translate": [
        r"dịch\s+(?:và\s+)?(?:gửi\s+)?(?:đến\s+)?(?:team\s*|tin\s*|t)?(\d|control)?[:\s]*(.+)",
        r"translate\s+(.+)",
    ],
}


def parse_voice_command(text: str):
    """
    Phân tích text từ voice để nhận diện lệnh.
    Returns: (command_type, params) hoặc (None, None) nếu không phải lệnh.
    """
    text_lower = text.lower().strip()

    # 1. Kiểm tra lệnh ĐỌC tin nhắn
    for pattern in COMMAND_PATTERNS["read"]:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            group_id = match.group(1).strip()
            if group_id.isdigit():
                group_name = f"T{group_id}"
            else:
                group_name = "CONTROL"
            return "read", {"group": group_name, "count": 10}

    # 2. Kiểm tra lệnh TARGET
    for pattern in COMMAND_PATTERNS["target"]:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            group_id = match.group(1).strip()
            if group_id.isdigit():
                group_name = f"T{group_id}"
            else:
                group_name = "CONTROL"
            return "target", {"group": group_name}

    # 3. Kiểm tra lệnh TÌM KIẾM
    for pattern in COMMAND_PATTERNS["search"]:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            keyword = match.group(1).strip()
            group = "all"
            if match.lastindex >= 2 and match.group(2):
                g = match.group(2).strip()
                if g.isdigit():
                    group = f"T{g}"
                elif "tất" in g or g == "all":
                    group = "all"
                else:
                    group = g.upper()
            return "search", {"keyword": keyword, "group": group}

    # 4. Kiểm tra lệnh DỊCH (nói "dịch: ...")
    for pattern in COMMAND_PATTERNS["translate"]:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            content = match.group(match.lastindex).strip()
            if content:
                return "translate", {"text": content}

    # Không phải lệnh → mặc định dịch toàn bộ
    return None, None


async def execute_voice_command(cmd_type, params, update, ctx, status_msg):
    """Thực hiện lệnh voice đã nhận diện."""
    user_id = update.effective_user.id
    settings = get_user_setting(user_id)

    if cmd_type == "read":
        group_name = params["group"]
        count = params["count"]
        chat_id, key = resolve_group(group_name)

        if chat_id is None:
            await status_msg.edit_text(
                f"❌ Unknown group: <b>{group_name}</b>",
                parse_mode="HTML",
            )
            return

        if not TELEGRAM_SESSION:
            await status_msg.edit_text(
                "❌ TELEGRAM_SESSION not configured.\n"
                "Cannot read messages without Telethon session.",
            )
            return

        await status_msg.edit_text(f"📖 Reading {count} messages from {key}...")

        try:
            client = await get_telethon_client()
            try:
                entity = await client.get_entity(chat_id)
                history = await client(GetHistoryRequest(
                    peer=entity, limit=count,
                    offset_date=None, offset_id=0, max_id=0,
                    min_id=0, add_offset=0, hash=0,
                ))

                if not history.messages:
                    await status_msg.edit_text(f"📭 No messages in {key}.")
                    return

                lines = [f"📋 <b>Last {len(history.messages)} messages — {key}:</b>\n"]
                user_map = {}
                for u in history.users:
                    name = u.first_name or ""
                    if u.last_name:
                        name += f" {u.last_name}"
                    user_map[u.id] = name.strip() or f"User#{u.id}"

                for msg in reversed(history.messages):
                    if not msg.message:
                        continue
                    msg_time = msg.date.astimezone(MYANMAR_TZ).strftime("%d/%m %H:%M")
                    sender = user_map.get(msg.from_id.user_id, "Unknown") if msg.from_id else "System"
                    content = html.escape(msg.message[:500])
                    if len(msg.message) > 500:
                        content += "..."
                    lines.append(f"🕐 <b>{msg_time}</b> | <b>{sender}</b>\n   {content}\n")

                result = "\n".join(lines)
                if len(result) > 4000:
                    result = result[:4000] + "\n\n... (truncated)"
                await status_msg.edit_text(result, parse_mode="HTML")

                # Lưu data cho TTS (trước khi disconnect)
                tts_messages = []
                for msg in reversed(history.messages):
                    if not msg.message:
                        continue
                    sender = user_map.get(msg.from_id.user_id, "Unknown") if msg.from_id else "System"
                    tts_messages.append((sender, msg.message[:200]))
                    if len(tts_messages) >= 5:  # Chỉ đọc 5 tin mới nhất
                        break
            finally:
                await client.disconnect()

            # 🔊 TTS — Đọc to tin nhắn bằng giọng nói (SAU KHI disconnect Telethon)
            try:
                tts_lines = [f"{s} nói: {m}" for s, m in tts_messages]
                tts_text = ". ".join(tts_lines)
                if tts_text:
                    mp3_path = await asyncio.to_thread(text_to_speech, tts_text, "vi")
                    if mp3_path:
                        with open(mp3_path, "rb") as audio:
                            await update.message.reply_voice(
                                voice=audio,
                                read_timeout=60,
                                write_timeout=60,
                            )
                        os.unlink(mp3_path)
            except Exception as tts_err:
                log.warning(f"TTS error (non-critical): {tts_err}")
        except Exception as e:
            await status_msg.edit_text(f"❌ Error: {e}")

    elif cmd_type == "target":
        group_name = params["group"]
        chat_id, key = resolve_group(group_name)
        if chat_id is None:
            await status_msg.edit_text(f"❌ Unknown group: <b>{group_name}</b>", parse_mode="HTML")
            return
        settings["target"] = chat_id
        labels = {"T1": "Dawei", "T2": "Myeik", "T3": "Bokpyin", "T4": "Kawthoung", "CONTROL": "Control"}
        label = labels.get(key, key)
        await status_msg.edit_text(
            f"✅ Target set: <b>{key}</b> ({label})\n"
            "Now send voice to translate and send! 🎤",
            parse_mode="HTML",
        )

    elif cmd_type == "search":
        keyword = params["keyword"]
        group = params["group"]

        if not TELEGRAM_SESSION:
            await status_msg.edit_text("❌ TELEGRAM_SESSION not configured.")
            return

        if group.upper() == "ALL":
            groups_to_search = list(GROUP_MAP.items())
        else:
            chat_id, key = resolve_group(group)
            if chat_id is None:
                await status_msg.edit_text(f"❌ Unknown group: <b>{group}</b>", parse_mode="HTML")
                return
            groups_to_search = [(key, chat_id)]

        await status_msg.edit_text(f"🔍 Searching '<b>{keyword}</b>'...", parse_mode="HTML")

        try:
            client = await get_telethon_client()
            try:
                all_results = []
                for gname, gchat_id in groups_to_search:
                    entity = await client.get_entity(gchat_id)
                    history = await client(GetHistoryRequest(
                        peer=entity, limit=200,
                        offset_date=None, offset_id=0, max_id=0,
                        min_id=0, add_offset=0, hash=0,
                    ))
                    user_map = {}
                    for u in history.users:
                        name = u.first_name or ""
                        if u.last_name:
                            name += f" {u.last_name}"
                        user_map[u.id] = name.strip() or f"User#{u.id}"

                    for msg in history.messages:
                        if msg.message and keyword.lower() in msg.message.lower():
                            msg_time = msg.date.astimezone(MYANMAR_TZ).strftime("%d/%m %H:%M")
                            sender = "System"
                            if msg.from_id:
                                sender = user_map.get(msg.from_id.user_id, "Unknown")
                            content = html.escape(msg.message[:200])
                            if len(msg.message) > 200:
                                content += "..."
                            all_results.append((gname, msg_time, sender, content))

                if not all_results:
                    await status_msg.edit_text(f"📭 No results for '<b>{keyword}</b>'.", parse_mode="HTML")
                    return

                lines = [f"🔍 Found <b>{len(all_results)}</b> results for '<b>{keyword}</b>':\n"]
                for gname, mtime, sender, content in all_results[:10]:
                    lines.append(f"📍 <b>[{gname}]</b> {mtime} | <b>{sender}</b>\n   {content}\n")
                if len(all_results) > 10:
                    lines.append(f"\n... +{len(all_results) - 10} more")

                result = "\n".join(lines)
                if len(result) > 4000:
                    result = result[:4000] + "\n\n... (truncated)"
                await status_msg.edit_text(result, parse_mode="HTML")
            finally:
                await client.disconnect()
        except Exception as e:
            await status_msg.edit_text(f"❌ Error: {e}")


# ═══════════════════════════════════════════════════════════
#  VOICE MESSAGE HANDLER
# ═══════════════════════════════════════════════════════════

async def handle_voice(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Nhận voice → STT → Nhận diện lệnh hoặc dịch + gửi."""
    user_id = update.effective_user.id
    settings = get_user_setting(user_id)

    # Bước 0: Thông báo đang xử lý
    status_msg = await update.message.reply_text("⏳ Listening...")

    tmp_path = None
    try:
        # Bước 1: Download voice file
        voice = update.message.voice
        voice_file = await ctx.bot.get_file(voice.file_id)

        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
            tmp_path = tmp.name
        await voice_file.download_to_drive(tmp_path)
        log.info(f"Downloaded voice: {tmp_path} ({voice.duration}s)")

        # Bước 2: Speech-to-Text (Whisper) — luôn nhận diện tiếng Việt trước
        await status_msg.edit_text("🎤 Recognizing speech...")
        original_text = await asyncio.to_thread(whisper_stt, tmp_path, "vi")
        log.info(f"STT result: {original_text[:100]}")

        if not original_text:
            await status_msg.edit_text("❌ Could not recognize speech. Please try again.")
            return

        await status_msg.edit_text(
            f"🎤 Heard: <i>\"{original_text}\"</i>\n\n⏳ Processing...",
            parse_mode="HTML",
        )

        # Bước 3: Nhận diện lệnh
        cmd_type, params = parse_voice_command(original_text)

        if cmd_type:
            log.info(f"Voice command detected: {cmd_type} → {params}")
            await execute_voice_command(cmd_type, params, update, ctx, status_msg)
        else:
            # Không phải lệnh → Dịch và gửi
            if settings["target"] is None:
                await status_msg.edit_text(
                    f"🎤 Heard: <i>\"{original_text}\"</i>\n\n"
                    "⚠️ No target group set. Use <code>/target T1</code> first,\n"
                    "or say: <i>\"Gửi đến Team 1\"</i>",
                    parse_mode="HTML",
                )
                return

            lang_pair = settings["lang"]
            src_lang, tgt_lang, desc = LANG_PAIRS[lang_pair]

            await status_msg.edit_text(f"🔄 Translating ({desc})...")
            translated_text = await asyncio.to_thread(
                translate_text, original_text, src_lang, tgt_lang
            )

            if not translated_text:
                await status_msg.edit_text("❌ Translation failed.")
                return

            # Gửi đến group đích
            target_chat_id = settings["target"]
            target_name = "Unknown"
            for k, v in GROUP_MAP.items():
                if v == target_chat_id:
                    target_name = k
                    break

            send_text = f"📝 {translated_text}"
            await ctx.bot.send_message(
                chat_id=target_chat_id, text=send_text, parse_mode="HTML",
            )

            now = datetime.now(MYANMAR_TZ).strftime("%H:%M:%S")
            confirm = (
                f"✅ <b>Sent to {target_name}!</b>\n\n"
                f"🎤 <b>Original ({src_lang}):</b>\n{original_text}\n\n"
                f"🔄 <b>Translated ({tgt_lang}):</b>\n{translated_text}\n\n"
                f"📍 Target: {target_name} | 🕐 {now}"
            )
            await status_msg.edit_text(confirm, parse_mode="HTML")

            # Lưu history
            if user_id not in translation_history:
                translation_history[user_id] = []
            translation_history[user_id].append({
                "original": original_text,
                "translated": translated_text,
                "time": now,
            })
            if len(translation_history[user_id]) > 20:
                translation_history[user_id] = translation_history[user_id][-20:]

    except Exception as e:
        log.error(f"Voice handler error: {e}", exc_info=True)
        await status_msg.edit_text(f"❌ Error: {e}")

    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════
#  TEXT MESSAGE HANDLER (gõ tiếng Việt → dịch → gửi)
# ═══════════════════════════════════════════════════════════

async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Nhận text tiếng Việt → Translate → Gửi đến group đích."""
    user_id = update.effective_user.id
    settings = get_user_setting(user_id)
    original_text = update.message.text.strip()

    # Bỏ qua nếu text trống
    if not original_text:
        return

    # Kiểm tra đã chọn target chưa
    if settings["target"] is None:
        await update.message.reply_text(
            "⚠️ Please set a target group first!\n"
            "Example: <code>/target T1</code>",
            parse_mode="HTML",
        )
        return

    # Lấy language pair
    lang_pair = settings["lang"]
    src_lang, tgt_lang, desc = LANG_PAIRS[lang_pair]

    status_msg = await update.message.reply_text(f"🔄 Translating ({desc})...")

    try:
        # Dịch
        translated_text = await asyncio.to_thread(
            translate_text, original_text, src_lang, tgt_lang
        )
        log.info(f"Text translation: {original_text[:60]} → {translated_text[:60]}")

        if not translated_text:
            await status_msg.edit_text("❌ Translation failed. Please try again.")
            return

        # Gửi đến group đích
        target_chat_id = settings["target"]
        target_name = "Unknown"
        for k, v in GROUP_MAP.items():
            if v == target_chat_id:
                target_name = k
                break

        send_text = f"📝 {translated_text}"
        await ctx.bot.send_message(
            chat_id=target_chat_id,
            text=send_text,
            parse_mode="HTML",
        )

        # Xác nhận
        now = datetime.now(MYANMAR_TZ).strftime("%H:%M:%S")
        confirm = (
            f"✅ <b>Sent to {target_name}!</b>\n\n"
            f"📝 <b>Original ({src_lang}):</b>\n{original_text}\n\n"
            f"🔄 <b>Translated ({tgt_lang}):</b>\n{translated_text}\n\n"
            f"📍 Target: {target_name} | 🕐 {now}"
        )
        await status_msg.edit_text(confirm, parse_mode="HTML")

        # Lưu history
        if user_id not in translation_history:
            translation_history[user_id] = []
        translation_history[user_id].append({
            "original": original_text,
            "translated": translated_text,
            "time": now,
        })
        if len(translation_history[user_id]) > 20:
            translation_history[user_id] = translation_history[user_id][-20:]

    except Exception as e:
        log.error(f"Text handler error: {e}", exc_info=True)
        await status_msg.edit_text(f"❌ Error: {e}")


# ═══════════════════════════════════════════════════════════
#  READ MESSAGES
# ═══════════════════════════════════════════════════════════

async def cmd_read(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/read <group> [count] — Đọc tin nhắn gần nhất từ group."""
    if not ctx.args:
        await update.message.reply_text(
            "⚠️ Usage: <code>/read T1</code> or <code>/read T2 20</code>",
            parse_mode="HTML",
        )
        return

    # Parse arguments
    group_name = ctx.args[0]
    count = 10  # mặc định
    if len(ctx.args) > 1:
        try:
            count = min(int(ctx.args[1]), 50)  # tối đa 50
        except ValueError:
            pass

    chat_id, key = resolve_group(group_name)
    if chat_id is None:
        await update.message.reply_text(
            f"❌ Unknown group: <b>{group_name}</b>\n"
            "Use: T1, T2, T3, T4, CONTROL",
            parse_mode="HTML",
        )
        return

    status_msg = await update.message.reply_text(f"📖 Reading {count} messages from {key}...")

    try:
        client = await get_telethon_client()
        try:
            entity = await client.get_entity(chat_id)
            history = await client(GetHistoryRequest(
                peer=entity,
                limit=count,
                offset_date=None,
                offset_id=0,
                max_id=0,
                min_id=0,
                add_offset=0,
                hash=0,
            ))

            if not history.messages:
                await status_msg.edit_text(f"📭 No messages found in {key}.")
                return

            lines = [f"📋 <b>Last {len(history.messages)} messages from {key}:</b>\n"]

            # Lấy danh sách user từ history
            user_map = {}
            for u in history.users:
                name = u.first_name or ""
                if u.last_name:
                    name += f" {u.last_name}"
                user_map[u.id] = name.strip() or f"User#{u.id}"

            for msg in reversed(history.messages):  # cũ → mới
                if not msg.message:
                    continue
                # Thời gian
                msg_time = msg.date.astimezone(MYANMAR_TZ).strftime("%d/%m %H:%M")
                # Tên người gửi
                sender = user_map.get(msg.from_id.user_id, "Unknown") if msg.from_id else "System"
                # Nội dung (cắt ngắn)
                content = html.escape(msg.message[:500])
                if len(msg.message) > 500:
                    content += "..."

                lines.append(f"🕐 <b>{msg_time}</b> | <b>{sender}</b>\n   {content}\n")

            result = "\n".join(lines)
            # Telegram giới hạn 4096 ký tự
            if len(result) > 4000:
                result = result[:4000] + "\n\n... (truncated)"
            await status_msg.edit_text(result, parse_mode="HTML")

        finally:
            await client.disconnect()

    except Exception as e:
        log.error(f"Read error: {e}", exc_info=True)
        await status_msg.edit_text(f"❌ Error reading messages: {e}")


# ═══════════════════════════════════════════════════════════
#  SEARCH MESSAGES
# ═══════════════════════════════════════════════════════════

async def cmd_search(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/search <group|all> <keyword> — Tìm tin nhắn theo keyword."""
    if len(ctx.args) < 2:
        await update.message.reply_text(
            "⚠️ Usage:\n"
            "  <code>/search T1 cable</code> — Search in T1\n"
            "  <code>/search all TNIXXXX</code> — Search all groups",
            parse_mode="HTML",
        )
        return

    group_name = ctx.args[0]
    keyword = " ".join(ctx.args[1:]).lower()

    # Xác định group cần search
    if group_name.upper() == "ALL":
        groups_to_search = list(GROUP_MAP.items())
    else:
        chat_id, key = resolve_group(group_name)
        if chat_id is None:
            await update.message.reply_text(
                f"❌ Unknown group: <b>{group_name}</b>",
                parse_mode="HTML",
            )
            return
        groups_to_search = [(key, chat_id)]

    status_msg = await update.message.reply_text(
        f"🔍 Searching '<b>{keyword}</b>' in {group_name.upper()}...",
        parse_mode="HTML",
    )

    try:
        client = await get_telethon_client()
        try:
            all_results = []

            for gname, gchat_id in groups_to_search:
                entity = await client.get_entity(gchat_id)
                # Lấy 200 tin nhắn gần nhất để search
                history = await client(GetHistoryRequest(
                    peer=entity,
                    limit=200,
                    offset_date=None,
                    offset_id=0,
                    max_id=0,
                    min_id=0,
                    add_offset=0,
                    hash=0,
                ))

                # Lấy user map
                user_map = {}
                for u in history.users:
                    name = u.first_name or ""
                    if u.last_name:
                        name += f" {u.last_name}"
                    user_map[u.id] = name.strip() or f"User#{u.id}"

                for msg in history.messages:
                    if msg.message and keyword in msg.message.lower():
                        msg_time = msg.date.astimezone(MYANMAR_TZ).strftime("%d/%m %H:%M")
                        sender = "System"
                        if msg.from_id:
                            sender = user_map.get(msg.from_id.user_id, "Unknown")
                        content = msg.message[:200]
                        if len(msg.message) > 200:
                            content += "..."
                        all_results.append((gname, msg_time, sender, content))

            if not all_results:
                await status_msg.edit_text(
                    f"📭 No messages containing '<b>{keyword}</b>' found.",
                    parse_mode="HTML",
                )
                return

            lines = [f"🔍 Found <b>{len(all_results)}</b> messages with '<b>{keyword}</b>':\n"]
            for gname, mtime, sender, content in all_results[:15]:  # tối đa 15 kết quả
                lines.append(
                    f"📍 <b>[{gname}]</b> {mtime} | <b>{sender}</b>\n"
                    f"   {content}\n"
                )

            if len(all_results) > 15:
                lines.append(f"\n... and {len(all_results) - 15} more results")

            result = "\n".join(lines)
            if len(result) > 4000:
                result = result[:4000] + "\n\n... (truncated)"
            await status_msg.edit_text(result, parse_mode="HTML")

        finally:
            await client.disconnect()

    except Exception as e:
        log.error(f"Search error: {e}", exc_info=True)
        await status_msg.edit_text(f"❌ Error searching: {e}")


# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════

def main():
    """Khởi chạy bot."""
    if not VOICE_BOT_TOKEN:
        print("❌ VOICE_BOT_TOKEN not set in .env")
        return
    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY not set in .env")
        return

    log.info("Starting TNI Voice Translate Bot...")

    # Python 3.14+ cần tạo event loop trước
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    app = ApplicationBuilder().token(VOICE_BOT_TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("groups", cmd_groups))
    app.add_handler(CommandHandler("target", cmd_target))
    app.add_handler(CommandHandler("lang", cmd_lang))
    app.add_handler(CommandHandler("history", cmd_history))
    app.add_handler(CommandHandler("read", cmd_read))
    app.add_handler(CommandHandler("search", cmd_search))

    # Voice message handler
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    # Text message handler (gõ tiếng Việt → dịch → gửi)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    log.info("Bot is running! Press Ctrl+C to stop.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()

