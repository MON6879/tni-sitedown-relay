import requests
import json

url = "https://script.google.com/macros/s/AKfycbxVi0BGDW7B_KBxcSEdw3yuHB9Rs2BemQEYeKDwsybJQdmQv-_0HqyGHjpZI6jupxll/exec"

try:
    resp = requests.post(url, json={"action": "store_site_down", "text": "Plan: 14/08/2026\nTest Data"}, timeout=15, allow_redirects=True)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text[:300]}")
except Exception as e:
    print(f"Error: {e}")
