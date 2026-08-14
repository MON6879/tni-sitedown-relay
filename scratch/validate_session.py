"""
Test TELEGRAM_SESSION format validity
"""
import os
import sys

session = os.environ.get("TELEGRAM_SESSION", "")
if not session:
    print("❌ TELEGRAM_SESSION is EMPTY or NOT SET!")
    sys.exit(1)

# Telethon StringSession must be base64-decodable and specific length
import base64

try:
    # Strip whitespace/newlines - common mistake when copying
    session_clean = session.strip()
    if session != session_clean:
        print(f"⚠️  Session has leading/trailing whitespace! Original len={len(session)}, Clean len={len(session_clean)}")

    # Try to decode
    # Add padding if needed
    padded = session_clean + "=" * (-len(session_clean) % 4)
    decoded = base64.b64decode(padded)
    print(f"✅ Session format looks OK: {len(session_clean)} chars, decoded to {len(decoded)} bytes")
    
    if len(session_clean) < 100:
        print(f"⚠️  Session is very short ({len(session_clean)} chars) - might be truncated or invalid!")
    
except Exception as e:
    print(f"❌ Session is INVALID base64: {e}")
    print(f"   -> Session length: {len(session)}")
    print(f"   -> First 10 chars: {session[:10]}")
    sys.exit(1)
