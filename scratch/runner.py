import sys, os, requests, urllib3, asyncio
sys.path.insert(0, '.')
urllib3.disable_warnings()

orig_get = requests.get
def patched_get(*args, **kwargs):
    kwargs['verify'] = False
    headers = kwargs.get('headers') or {}
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    kwargs['headers'] = headers
    return orig_get(*args, **kwargs)
requests.get = patched_get

import daily_bod_assign
import backlog_send
import cron_send

async def run_all():
    print('--- 1. Executing daily_bod_assign ---')
    try:
        await daily_bod_assign.main()
        print('✅ BOD assign sent!')
    except Exception as e: print('BOD err:', e)

    print('--- 2. Executing backlog_send --now ---')
    try:
        sys.argv = ['backlog_send.py', '--now']
        await backlog_send.main()
        print('✅ Backlog send completed!')
    except Exception as e: print('Backlog err:', e)

    print('--- 3. Executing cron_send ---')
    try:
        await cron_send.main()
        print('✅ Cron send (Reports 1, 2, 3, 4) completed!')
    except Exception as e: print('Cron err:', e)

asyncio.run(run_all())
