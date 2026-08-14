import os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

INTERNAL_URL = "https://10.201.77.35:21180/web/iui/framework/login.html"

users_to_test = ["TNI View", "TNI_View", "TNIView", "tni view", "tni_view"]
pwd = "Maitruong3011@"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--ignore-certificate-errors", "--no-sandbox"])
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()
    
    for u in users_to_test:
        print(f"🔑 Testing User: '{u}' | Pass: '{pwd}'...")
        page.goto(INTERNAL_URL, wait_until="domcontentloaded")
        time.sleep(2)
        
        user_input = page.query_selector("input[type='text']")
        if user_input:
            user_input.fill("")
            user_input.fill(u)
            
        pass_input = page.query_selector("input[type='password']")
        if pass_input:
            pass_input.fill("")
            pass_input.fill(pwd)
            
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
        
        time.sleep(5)
        url = page.url
        error_el = page.query_selector(".alert, .error, :has-text('incorrect')")
        err_text = error_el.inner_text().strip() if error_el else ""
        
        print(f"Result URL: {url} | Error: {err_text}")
        if "login.html" not in url or ("incorrect" not in err_text.lower() and len(url) > 40):
            print(f"🎉🎉🎉 SUCCESS WITH USERNAME: '{u}'!")
            page.screenshot(path="scratch/success_tni_view.png")
            
            # Save correct user to .env
            env_file = Path(r"d:\6. AI\1. QLTC\ICT Fetch\.env")
            env_content = f"""# Credentials cho ZTE NetNumen
INTERNAL_URL=https://10.201.77.35:21180/web/iui/framework/login.html
INTERNAL_USER={u}
INTERNAL_PASS=Maitruong3011@
# Google Sheets
GSHEET_ID=1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0
GSHEET_TAB=Input ICT
"""
            env_file.write_text(env_content, encoding="utf-8")
            print("✅ Saved new credentials to .env!")
            browser.close()
            sys.exit(0)
            
    browser.close()
