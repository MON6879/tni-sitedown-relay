import asyncio
import os
import sys
sys.path.append('.')
from cron_send import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION

os.environ["TELEGRAM_API_ID"] = str(TELEGRAM_API_ID)
os.environ["TELEGRAM_API_HASH"] = TELEGRAM_API_HASH
os.environ["TELEGRAM_SESSION"] = TELEGRAM_SESSION
os.environ["FORCE_RUN"] = "1"

import botlookup_relay

asyncio.run(botlookup_relay.main())
