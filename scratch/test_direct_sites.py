import os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

LOGIN_URL = "https://10.201.77.35:21180/web/iui/framework/login.html"
SITES_URL = "https://10.201.77.35:21180/web/res/power-newsitescreen/newsitescreen.html"
USER = "TNI View"
PASS = "Maitruong3011@"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--ignore-certificate-errors", "--no-sandbox"])
    ctx = browser.new_context(ignore_https_errors=True, accept_downloads=True)
    page = ctx.new_page()
    
    print("1. Logging in...")
    page.goto(LOGIN_URL, wait_until="domcontentloaded")
    page.fill("input[type='text']", USER)
    page.fill("input[type='password']", PASS)
    page.click("button:has-text('Login')")
    time.sleep(3)
    try:
        page.click("button:has-text('Continue')", timeout=5000)
    except: pass
    time.sleep(5)
    print(f"Logged in. Current URL: {page.url}")
    
    print("2. Navigating directly to SITES_URL...")
    page.goto(SITES_URL, wait_until="domcontentloaded")
    time.sleep(5)
    print(f"Direct SITES URL: {page.url}")
    
    # Scan frames or page buttons
    btns = page.evaluate("""
        () => {
            const r = [];
            document.querySelectorAll('button,a,.btn,[role=button],input[type=button]').forEach(el => {
                const t = (el.innerText||el.value||el.textContent||'').trim();
                if(t) r.push({text:t.substring(0,40), cls:el.className||'', tag:el.tagName});
            });
            return r;
        }
    """)
    print(f"Buttons on direct SITES page: {len(btns)}")
    for b in btns:
        if "export" in b['text'].lower() or "xls" in b['text'].lower():
            print(f"  ⭐ Candidate: {b}")
            
    browser.close()
