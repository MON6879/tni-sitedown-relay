import sys
sys.path.append('.')
from daily_plan_report import get_team_leaders

leaders = get_team_leaders()
print("Loaded leaders:")
for k, v in leaders.items():
    print(f"  {k}: {v}")
