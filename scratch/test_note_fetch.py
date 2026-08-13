import sys
sys.path.append('.')
from cron_send import get_control_note_from_sheet

note = get_control_note_from_sheet()
print("Fetched Control Note via cron_send.py:")
print("--------------------------------------")
print(note)
print("--------------------------------------")
