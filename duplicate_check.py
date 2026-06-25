"""
duplicate_check.py
==================
Quét tất cả file .js và .gs trong thư mục hiện tại,
tìm hàm trùng tên (function xxx) → cảnh báo trước khi clasp push.

Chạy: python duplicate_check.py
Exit code 0 = OK, 1 = có trùng
"""

import re
import sys
from pathlib import Path

def main():
    folder = Path(".")
    files = sorted(list(folder.glob("*.js")) + list(folder.glob("*.gs")))

    # regex: bắt tên hàm ở đầu dòng (không thụt lề = top-level function)
    pattern = re.compile(r"^function\s+(\w+)\s*\(", re.MULTILINE)

    # { function_name: [(file, line_number), ...] }
    registry = {}

    for fpath in files:
        try:
            lines = fpath.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            m = pattern.match(line)
            if m:
                name = m.group(1)
                registry.setdefault(name, []).append((fpath.name, i))

    # Tìm trùng
    dupes = {k: v for k, v in registry.items() if len(v) > 1}

    if not dupes:
        print(f"✅ No duplicate functions found across {len(files)} files ({len(registry)} functions total)")
        return 0

    print(f"🔴 DUPLICATE FUNCTIONS DETECTED! ({len(dupes)} duplicates)\n")
    for name, locations in sorted(dupes.items()):
        print(f"  function {name}():")
        for fname, line in locations:
            print(f"    → {fname}:{line}")
        print()

    print("⚠️  Fix these before running 'clasp push'!")
    print("   GAS shares a global namespace — last-loaded file wins.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
