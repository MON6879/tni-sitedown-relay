"""
Test gọi trực tiếp GAS URL để kiểm tra kết nối.
Chạy: python scratch/test_gas_direct.py <GAS_URL>
"""
import sys, requests, json

# Thay URL này bằng URL GAS thực của bạn nếu muốn test thủ công
GAS_URL = sys.argv[1] if len(sys.argv) > 1 else ""

if not GAS_URL:
    print("Usage: python scratch/test_gas_direct.py <GAS_URL>")
    print()
    print("Testing via Vercel env var instead...")
    # Kiểm tra Vercel có pass được GAS URL không bằng cách call endpoint debug
    r = requests.get("https://tni-bot.vercel.app/api/refuel_collector", timeout=10)
    print(f"Vercel GET status: {r.status_code}")
    print(f"Vercel response: {r.text}")
    sys.exit(0)

print(f"Testing GAS URL directly: {GAS_URL[:60]}...")

# Test 1: GET request
print("\n[1] GET request:")
try:
    r = requests.get(GAS_URL, timeout=15)
    print(f"  Status: {r.status_code}")
    print(f"  Response: {r.text[:200]}")
except Exception as e:
    print(f"  Error: {e}")

# Test 2: POST với payload Plan
print("\n[2] POST collect_message (PLAN):")
payload = {
    "action": "collect_message",
    "group_id": "6859790680",
    "text": "Plan refuel 10/07/2026 Team 3\nTNI0061: 440L\nTNI0319: 440L",
    "sender": "Test User",
    "sender_id": "123456789",
    "date": "10/07/2026 12:00"
}
try:
    r = requests.post(GAS_URL, json=payload, timeout=15)
    print(f"  Status: {r.status_code}")
    print(f"  Response: {r.text[:300]}")
except Exception as e:
    print(f"  Error: {e}")
