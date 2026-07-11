import re

with open(r'd:\6. AI\1. QLTC\Task and WO\api\collector.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_handle_mdg = """async def handle_mdg(msg, bot, now, user, sender_name, sender_id):
    \"\"\"Handle all messages from the TNI COLLECT MDG RUN group.\"\"\"
    chat_id = msg.chat_id

    # ── Photos ──────────────────────────────────────────────────────────
    if msg.photo:
        largest = msg.photo[-1]
        try:
            file_info = await bot.get_file(largest.file_id)
            tg_url = (
                f"https://api.telegram.org/file/bot{COLLECTOR_BOT_TOKEN}/"
                f"{file_info.file_path}"
            )
        except Exception as e:
            logger.error(f"MDG get_file error: {e}")
            tg_url = ""

        ref_id = None
        caption = msg.caption or ""
        ref_m = re.search(r"REF[:\s#]*(\d+)", caption, re.IGNORECASE)
        if ref_m:
            ref_id = ref_m.group(1)
        elif msg.reply_to_message:
            reply_text = msg.reply_to_message.text or ""
            ref_m = re.search(r"REF[:\s#]*(\d+)", reply_text, re.IGNORECASE)
            if ref_m:
                ref_id = ref_m.group(1)

        action_name = "process_photo"
        if msg.reply_to_message and msg.reply_to_message.text:
            rt_upper = msg.reply_to_message.text.upper()
            if "INVENTORY" in rt_upper:
                action_name = "inv_add_photo"
            elif "MDG" in rt_upper:
                action_name = "mdg_add_photo"

        # ── Send file_id + tg_url to Apps Script (GAS downloads — no timeout) ──
        filename = f"MDG_{sender_id}_{now.strftime('%Y%m%d_%H%M%S')}.jpg"
        result   = post_mdg_photo({
            "action":      action_name,
            "ref_id":      ref_id,
            "tg_url":      tg_url,
            "tg_file_id":  largest.file_id,
            "filename":    filename,
            "sender_name": sender_name,
            "sender_id":   sender_id,
            "date":        now.strftime("%d/%m/%Y %H:%M"),
        })
        actual_ref = result.get("ref") or ref_id
        ref_show   = str(actual_ref).zfill(5) if actual_ref else "?????"
        status     = result.get("status", "error")

        if status == "ok":
            photo_num = result.get("photoNum", "")
            msg_type = result.get("type", "")
            prefix = "⛽" if msg_type == "INV" else "📷"
            await bot.send_message(
                chat_id,
                f"{prefix} <b>REF:{ref_show}</b> | Photo {photo_num} saved",
                parse_mode="HTML",
            )
        elif status == "processing":
            await bot.send_message(
                chat_id,
                f"📷 <b>REF:{ref_show}</b> | Photo submitted ⏳ (uploading to Drive...)",
                parse_mode="HTML",
            )
        else:
            err = html.escape(result.get("message", "Upload failed"))
            await bot.send_message(
                chat_id,
                f"⚠️ Photo error (REF:{ref_show}): {err}",
                parse_mode="HTML",
            )
        return

    if not msg.text:
        return

    text = msg.text.strip()

    # ── /start ──────────────────────────────────────────────────────────
    if text.lower().startswith("/start"):
        await bot.send_message(
            chat_id,
            "⚡ <b>TNI MDG Run & Inventory Collector</b>\\n"
            "━━━━━━━━━━━━━━━━━━━━━\\n"
            "📌 <b>Send report in correct format</b>\\n"
            "✅ <b>Confirm:</b> Reply bot message with <code>Confirm</code>\\n"
            "📷 <b>Photo:</b> Send photo (reply to bot msg with REF) — max 6",
            parse_mode="HTML",
        )
        return

    # ── Confirm reply ────────────────────────────────────────────────────
    if text.lower() == "confirm" and msg.reply_to_message:
        reply_text = msg.reply_to_message.text or ""
        ref_m = re.search(r"REF:(\d+)", reply_text)
        if ref_m:
            ref_id = ref_m.group(1)
            action_name = "mdg_confirm"
            if "INVENTORY" in reply_text.upper():
                action_name = "inv_confirm"
            
            result = post_mdg_sheet({
                "action":       action_name,
                "ref_id":       ref_id,
                "confirmed_by": sender_name,
                "date":         now.strftime("%d/%m/%Y %H:%M"),
            })
            if result.get("status") == "ok":
                await bot.send_message(
                    chat_id,
                    f"✅ <b>REF:{str(ref_id).zfill(5)}</b> — Confirmed by {html.escape(sender_name)}",
                    parse_mode="HTML",
                )
            else:
                err = html.escape(result.get("message", "unknown error"))
                await bot.send_message(chat_id, f"⚠️ Confirm failed: {err}", parse_mode="HTML")
        return

    # ── Inventory Report message ─────────────────────────────────────────
    if "inventory fuel" in text.lower():
        fields = parse_inv_fields(text)
        dg_id = fields.get("dg id", "")

        payload = {
            "action":      "inv_add",
            "date":        now.strftime("%d/%m/%Y"),
            "time":        now.strftime("%H:%M"),
            "sender_name": sender_name,
            "sender_id":   sender_id,
            "fields":      fields,
            "raw":         text,
        }

        result = post_mdg_sheet(payload)

        if result.get("status") == "ok":
            ref = result.get("ref") or str(result.get("row", "???")).zfill(5)
            dg_show = html.escape(dg_id) if dg_id else "—"
            await bot.send_message(
                chat_id,
                f"⛽ <b>REF:{ref}</b> | INVENTORY | {dg_show} | {now.strftime('%d/%m/%Y %H:%M')}\\n"
                f"✅ Reply <code>Confirm</code> to close | 📷 Photo → reply this msg",
                parse_mode="HTML",
            )
        else:
            err = html.escape(result.get("message", "Apps Script error"))
            await bot.send_message(chat_id, f"⚠️ Failed to record: {err}", parse_mode="HTML")
        return

    # ── MDG Report message ───────────────────────────────────────────────
    if "mdg" in text.lower():
        fields = parse_mdg_fields(text)
        site_id = fields.get("site id", "")

        payload = {
            "action":      "mdg_add",
            "date":        now.strftime("%d/%m/%Y"),
            "time":        now.strftime("%H:%M"),
            "sender_name": sender_name,
            "sender_id":   sender_id,
            "fields":      fields,
            "raw":         text,
        }

        result = post_mdg_sheet(payload)

        if result.get("status") == "ok":
            ref = result.get("ref") or str(result.get("row", "???")).zfill(5)
            site_show = html.escape(site_id) if site_id else "—"
            await bot.send_message(
                chat_id,
                f"⚡ <b>REF:{ref}</b> | MDG | {site_show} | {now.strftime('%d/%m/%Y %H:%M')}\\n"
                f"✅ Reply <code>Confirm</code> to close | 📷 Photo → reply this msg",
                parse_mode="HTML",
            )
        else:
            err = html.escape(result.get("message", "Apps Script error"))
            await bot.send_message(chat_id, f"⚠️ Failed to record: {err}", parse_mode="HTML")
        return"""

start_str = "async def handle_mdg(msg, bot, now, user, sender_name, sender_id):"
end_str = "# ============================================================\n# MAIN HANDLER"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_handle_mdg + "\n\n\n" + content[end_idx:]
    with open(r'd:\6. AI\1. QLTC\Task and WO\api\collector.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced handle_mdg successfully.")
else:
    print("Could not find start or end block.")
