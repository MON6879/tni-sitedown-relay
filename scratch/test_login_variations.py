import os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

INTERNAL_URL = "https://10.201.77.35:21180/web/iui/framework/login.html"

users_to_test = ["MON6879", "mon6879"]
passes_to_test = ["Maitruong3011@", "maitruong3011@", "MAITRUONG3011@"]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--ignore-certificate-errors", "--no-sandbox"])
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()
    
    for u in users_to_test:
        for pwd in passes_to_test:
            print(f"Testing User: '{u}' | Pass: '{pwd}'...")
            page.goto(INTERNAL_URL, wait_until="domcontentloaded")
            time.sleep(2)
            
            # Clear inputs
            page.evaluate("""
                () => {
                    document.querySelectorAll('input').forEach(i => i.value = '');
                }
            """)
            
            # Type username and password char by char
            user_input = page.query_selector("input[type='text']")
            if user_input:
                user_input.fill("")
                user_input.type(u, delay=50)
                
            pass_input = page.query_selector("input[type='password']")
            if pass_input:
                pass_input.fill("")
                pass_input.type(pwd, delay=50)
                
            time.sleep(1)
            page.click("button:has-text('Login')")
            time.sleep(3)
            
            # Handle warning / continue dialog
            try:
                dialog_btn = page.query_selector("button:has-text('Continue'), button:has-text('OK'), .btn-primary")
                if dialog_btn:
                    dialog_btn.click()
                    time.sleep(3)
            except: pass
            
            time.sleep(3)
            url = page.url
            error_el = page.query_selector(".alert, .error, :has-text('incorrect')")
            err_text = error_el.inner_text().strip() if error_el else ""
            
            print(f"Result URL: {url} | Error: {err_text}")
            if "login.html" not in url or ("incorrect" not in err_text.lower() and len(url) > 50):
                print(f"🎉 SUCCESS WITH User: '{u}' | Pass: '{pwd}'!")
                page.screenshot(path=f"scratch/success_{u}.png")
                browser.close()
                sys.exit(0)
                
    browser.close()
