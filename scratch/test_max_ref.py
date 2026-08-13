import sys
sys.path.append('.')
from api.search_bot import fetch_max_plan_ref

ref = fetch_max_plan_ref()
print("Calculated next REF:", ref)
