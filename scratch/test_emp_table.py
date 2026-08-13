import asyncio
import sys
sys.path.append('.')

def build_employee_table(team_name: str, staff_list: list) -> str:
    """
    Tạo Bảng tổng hợp Nhân viên dạng TABLE (Monospace Codeblock)
    gồm: Name | Rk | Close% | WO (Mo/7D/3D) | Task A/C
    """
    lines = [
        f"📊 BẢNG TỔNG HỢP CHỈ SỐ NHÂN VIÊN — {team_name}",
        "<pre>",
        f"{'NVKTV':<16} {'Rk':<4} {'Close%':<8} {'WO 3D':>7} {'Rem':>4} {'Task A/C':>8}",
        "─" * 52
    ]
    
    for s in staff_list:
        color = s.get("color", "🟢")
        name  = s.get("name", "")[:15]
        rank  = s.get("rank", "?")
        close = f"{s.get('close_pct', 0)}%"
        wo3d  = s.get("wo_3day", "0/0/0")
        rem   = s.get("wo_remain", 0)
        task  = f"{s.get('task_assign',0)}/{s.get('task_close',0)}"
        
        lines.append(
            f"{color}{name:<14} #{rank:<3} {close:>7} {wo3d:>7} {rem:>4} {task:>8}"
        )
        
    lines.append("─" * 52)
    lines.append("</pre>")
    return "\n".join(lines)

# Sample test
sample_staff = [
    {"name": "Aung Lwin Phyo", "rank": 18, "close_pct": 18, "wo_3day": "0/0/0", "wo_remain": 84, "task_assign": 6, "task_close": 0, "color": "🔴"},
    {"name": "Aung Thin Myat", "rank": 1, "close_pct": 85, "wo_3day": "1/0/0", "wo_remain": 4, "task_assign": 4, "task_close": 3, "color": "🟢"},
    {"name": "Bhone Htet Aung", "rank": 23, "close_pct": 4, "wo_3day": "0/0/0", "wo_remain": 52, "task_assign": 5, "task_close": 0, "color": "🔴"},
]

table_text = build_employee_table("Team 1 Dawei", sample_staff)
print(table_text)
