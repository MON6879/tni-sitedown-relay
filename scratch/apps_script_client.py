"""Helper để gọi Google Apps Script đúng cách: POST → GET echo URL."""
import requests

def call_apps_script(url: str, payload: dict, timeout: int = 120) -> dict:
    """
    Google Apps Script web app flow:
    1. POST to exec URL  → 302 redirect to echo URL
    2. GET the echo URL  → actual JSON response
    """
    session = requests.Session()
    # Bước 1: POST, lấy redirect URL
    r1 = session.post(url, json=payload, allow_redirects=False, timeout=60)
    if r1.status_code in (301, 302, 303, 307, 308):
        echo_url = r1.headers.get("Location", "")
        if echo_url:
            # Bước 2: GET echo URL để lấy kết quả
            r2 = session.get(echo_url, timeout=timeout)
            return r2.json()
    # Fallback: nếu không redirect, parse response gốc
    return r1.json()
