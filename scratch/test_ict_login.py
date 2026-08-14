import os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

INTERNAL_URL  = "https://10.201.77.35:21180/web/iui/framework/login.html"
INTERNAL_USER = "MON6879"
INTERNAL_PASS = "Maitruong3011@"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--ignore-certificate-errors", "--no-sandbox"])
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()
    print("Navigating to login...")
    page.goto(INTERNAL_URL, wait_until="domcontentloaded")
    page.screenshot(path="scratch/step1_login_page.png")
    
    page.fill("input[type='text']", INTERNAL_USER)
    page.fill("input[type='password']", INTERNAL_PASS)
    page.screenshot(path="scratch/step2_filled.png")
    
    page.click("button:has-text('Login')")
    time.sleep(3)
    page.screenshot(path="scratch/step3_after_login_click.png")
    
    # Check for Continue dialog or any modal
    dialog_btn = page.query_selector("button:has-text('Continue'), button:has-text('OK'), .btn-primary")
    if dialog_btn:
        print(f"Dialog button text: {dialog_btn.inner_text()}")
        dialog_btn.click()
        time.sleep(3)
        page.screenshot(path="scratch/step4_after_dialog_click.png")
        
    print("Waiting 10s...")
    time.sleep(10)
    page.screenshot(path="scratch/step5_final.png")
    print(f"Final URL: {page.url}")
    print(f"Frames: {len(page.frames)}")
    for i, f in enumerate(page.frames):
        print(f"Frame {i}: {f.url}")
    browser.close()
