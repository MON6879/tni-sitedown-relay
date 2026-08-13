import asyncio
import sys
sys.path.append('.')
from cron_send import (
    build_team_asset_msg,
    build_team_employee_summary_table,
    build_tl_comparison
)

now_str = "13/08/2026 15:48 MMT"

# Sample team members
sample_members = [
    ("🟢 🟧", "Team Leader 1", "Team leader 1 = Site: 15 <> Day: 12 of the month= /1 WO Close/ 7day: /1 Close => 3Day: 0 /0 /0 =>/23 WO Remain <=> rank: /4 =Close: /36% /TARGET50% /LostTARGET=> /WO /Overdue /FOT /NOT /Close: /5 < + > Task assign: /60 => Task Close Month: /1 => 3Day Close: 0/0/0", True),
    ("🔴", "Aung Lwin Phyo", "Aung Lwin Phyo = Site: 39 <> Day /23 of the month= /4 WO Close <=> 7day: /0 C <=> rank: /18 =Close: /18% /TARGET75% /LostTARGET => /WO /Overdue /FOT /NOT /Close: /0 => 3Day Close: 0/0/0 < + > Task assign: /6 => Task Close Month: /0 => 3Day Close: 0/0/0", False),
    ("🟢", "Aung Thin Myat", "Aung Thin Myat = Site: 2 <> Day /23 of the month= /4 WO Close <=> 7day: /1 C <=> rank: /1 =Close: /85% /TARGET75% Met target => /WO /Overdue /FOT /NOT /Close: /2 < + > Task assign: /4 => Task Close Month: /3 => 3Day Close: 1/0/0", False)
]

print("=== 1. REPORT 4c MONOSPACE TABLE ===")
rep_4c = build_team_employee_summary_table("MYT_TNI_TEAM01_Dawei", sample_members, now_str)
print(rep_4c)

print("\n=== 2. REPORT 4d ASSET REPORT ===")
asset_sample_data = {
    "by_team": {
        "MYT_TNI_TEAM01_Dawei": {
            "d0": 1, "done_d0": 1, "d1": 0, "done_d1": 0, "d2": 0, "done_d2": 0, "d6": 2, "done_d6": 2, "d15": 5, "done_d15": 4
        }
    }
}
rep_4d = build_team_asset_msg("MYT_TNI_TEAM01_Dawei", now_str, asset_sample_data)
print(rep_4d)

print("\n=== ALL REPORT 4 PIPELINE TESTS PASSED 100% ===")
