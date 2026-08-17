"""
api/plan_dep.py
================
Vercel serverless proxy & handler for BI Portal Plan Week tab.
Provides same-origin access for the web frontend to communicate with Google Sheets / Apps Script backend.
Endpoint: https://tni-bot.vercel.app/api/plan_dep
"""
import os
import json
import urllib.parse
import requests
from http.server import BaseHTTPRequestHandler

# Active GAS Web App URLs (with fallback)
GAS_ENDPOINTS = [
    "https://script.google.com/macros/s/AKfycbxC_wvkPyZLSzMqAnfs8akiZsElNTDmxWtTpALuqkIF-Ygjb_tb595jy3-L5AEaL5R3hQ/exec",
    "https://script.google.com/macros/s/AKfycbzidgWuL0DfKvkdDjKnN4qCRy4HUv8lIzvGiO3ZR84e-VLbu84IITd9H2HPSJW28yzhOw/exec",
    "https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec",
]

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = parsed.query
        
        # Forward GET to GAS endpoints
        response_data = None
        for endpoint in GAS_ENDPOINTS:
            try:
                url = f"{endpoint}?{qs}" if qs else endpoint
                resp = requests.get(url, headers={"User-Agent": "TNI-BI-Proxy/1.0"}, timeout=15, allow_redirects=True)
                if resp.status_code == 200 and resp.text.strip().startswith("{"):
                    response_data = resp.text
                    break
            except Exception:
                continue

        if not response_data:
            # Fallback direct gviz reading from Google Sheets
            response_data = json.dumps({
                "status": "error",
                "version": "1.0",
                "data": [],
                "error": {"code": "PROXY_FETCH_ERROR", "message": "Could not connect to GAS backend"}
            })

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_data.encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8")
        
        response_data = None
        for endpoint in GAS_ENDPOINTS:
            try:
                resp = requests.post(
                    endpoint,
                    data=post_body,
                    headers={"Content-Type": "text/plain;charset=utf-8"},
                    timeout=20,
                    allow_redirects=True
                )
                if resp.status_code == 200 and resp.text.strip().startswith("{"):
                    response_data = resp.text
                    break
            except Exception:
                continue

        if not response_data:
            response_data = json.dumps({
                "status": "error",
                "version": "1.0",
                "error": {"code": "POST_ERROR", "message": "Failed to proxy POST request to backend"}
            })

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_data.encode("utf-8"))

    def log_message(self, *a):
        pass
