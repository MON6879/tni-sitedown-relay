"""Preview Report 4 message content (no Telegram send)."""
import asyncio, io, os, sys
import pandas as pd, requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
load_dotenv()

# Patch to only show first team message
import cron_send as cs

async def preview():
    now = datetime.now(cs.TZ_MM)
    now_str = now.strftime("%d/%m/%Y %H:%M")
    
    note_text = cs.get_note_from_sheet()
    print(f"=== NOTE TEXT ===\n{repr(note_text)}\n")
    
    # Build a sample team_lines_indiv
    t_name = "Team1 Dawei"
    team_lines_indiv = [
        f"📋 4. Report — Daily EOD Task & Stats — {t_name}",
        f"📅 {now_str}",
        f"📌 Today's EOD summary of tasks completed, close rate, rank, asset and search stats.",
        "━━━━━━━━━━━━━━━━━━━━"
    ]
    if note_text:
        team_lines_indiv.append(f"📝 NOTE:\n{note_text}")
        team_lines_indiv.append("────────────────────")
    team_lines_indiv.append("👷 FT Staff Summary:")
    team_lines_indiv.append("(... employee data ...)")
    team_lines_indiv.append("━━━━━━━━━━━━━━━━━━━━")
    team_lines_indiv.append("👥 Total: 10 members")
    
    msg = "\n".join(team_lines_indiv)
    print(f"=== REPORT 4 PREVIEW ===\n{msg}\n")
    print(f"NOTE in message: {'📝 NOTE' in msg}")

asyncio.run(preview())
