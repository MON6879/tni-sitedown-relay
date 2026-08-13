import os
import sys
from dotenv import load_dotenv
load_dotenv()

print("TELEGRAM_API_ID present:", bool(os.getenv("TELEGRAM_API_ID")))
print("TELEGRAM_API_HASH present:", bool(os.getenv("TELEGRAM_API_HASH")))
print("TELEGRAM_SESSION present:", bool(os.getenv("TELEGRAM_SESSION")))
