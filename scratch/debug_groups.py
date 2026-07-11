"""
Debug script: in ra tất cả group/channel mà @Phongha79 là thành viên
So sánh với ALL_GROUPS trong botlookup_relay.py
"""
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID   = 38060453
API_HASH = "49dbb07f2d226a968571b11eab076d73"
SESSION  = "1BVtsOMEBu7v_GE-N-rKulnkKK3O-sBE1PMqnCjRi2VApCCU0bXDDsVf61kLHRzOllToqERAfbUmz3ZK0rsQxyPP-GNs--6bG82sdQ5TvuLIE9DZCgWHYZxaN4DjR5NheaWZHRgzt995kE_tgxiLHevhRdpcgb6lEjSgHHN0YtKaOzgHhV4-rzjWuH7HJjXOVK-MHjVXJ8H2oGFe0kXFxETnmCKAr_esBcwvGoLJYPiXyCtIuKQQVOItx6OB9WruotkeO3I1JVcgFu3S96QvfhqqsKkXc_vEP4d-u9S-ZvqvrYJSEf2u-6z0YScZwIrsiGUAYnDUy5ylUEVXkAXN3A5vTNSBEqPk="

# IDs hiện tại trong code
ALL_GROUPS = {
    "CONTROL": -5251698940,
    "T1":      -5180992881,
    "T2":      -5188855349,
    "T3":      -5183480727,
    "T4":      -5238696719,
}

async def main():
    client = TelegramClient(StringSession(SESSION), API_ID, API_HASH)
    async with client:
        me = await client.get_me()
        print(f"Logged in as: @{me.username} ({me.first_name})\n")
        print("=" * 70)
        print(f"{'Title':<40} {'Entity ID':>15} {'Type':<15} {'Match'}")
        print("=" * 70)

        target_ids = {abs(v): k for k, v in ALL_GROUPS.items()}

        async for dialog in client.iter_dialogs():
            eid = getattr(dialog.entity, 'id', 0)
            etype = type(dialog.entity).__name__
            match = target_ids.get(abs(eid), "")
            if match or "TNI" in dialog.title.upper():
                marker = f"<<< {match}" if match else ""
                print(f"{dialog.title:<40} {eid:>15} {etype:<15} {marker}")

        print("\n" + "=" * 70)
        print("Checking exact IDs:")
        for gname, gid in ALL_GROUPS.items():
            try:
                entity = await client.get_entity(int(gid))
                print(f"  {gname} ({gid}): FOUND -> {entity.id} | {type(entity).__name__}")
            except Exception as ex:
                print(f"  {gname} ({gid}): ERROR -> {ex}")

asyncio.run(main())
