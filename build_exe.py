"""
Script đóng gói DuoJukebox thành file DuoJukebox.exe độc lập (Standalone Windows Application)
sử dụng DuoJukebox.spec.
"""

import os
import sys
import subprocess
import shutil
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SPEC_FILE = os.path.join(BASE_DIR, "DuoJukebox.spec")

# Tự động tắt DuoJukebox.exe nếu đang mở để tránh bị khóa file
try:
    subprocess.run(["taskkill", "/F", "/IM", "DuoJukebox.exe", "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
except Exception:
    pass

print("=" * 60)
print("  [*] BẮT ĐẦU ĐÓNG GÓI DUOJUKEBOX.EXE BẰNG PYINSTALLER...")
print("=" * 60)

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--noconfirm",
    "--clean",
    SPEC_FILE
]

res = subprocess.run(cmd)

if res.returncode == 0:
    exe_path = os.path.join(BASE_DIR, "dist", "DuoJukebox.exe")
    root_exe = os.path.join(BASE_DIR, "DuoJukebox.exe")
    try:
        shutil.copy2(exe_path, root_exe)
        print(f"  [+] Đã copy file exe ra thư mục gốc: {root_exe}")
    except Exception as e:
        print(f"  [!] Không thể copy ra thư mục gốc: {e}")
    print("\n" + "=" * 60)
    print("  [+] ĐÓNG GÓI THÀNH CÔNG DUOJUKEBOX.EXE!")
    print(f"  [+] File thực thi: {root_exe}")
    print("=" * 60)
else:
    print(f"\n[!] Đóng gói thất bại với mã lỗi: {res.returncode}")
    sys.exit(res.returncode)
