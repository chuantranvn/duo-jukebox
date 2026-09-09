#!/usr/bin/env bash
# ======================================================================
#   🎵 DuoJukebox - Cài đặt tự động cho NanoPi M4 (Ubuntu / Armbian) 🎵
# ======================================================================

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "======================================================================"
echo "    [*] BẮT ĐẦU CÀI ĐẶT DUOJUKEBOX CHO NANOPi M4 (LINUX)"
echo "======================================================================"
echo ""

echo "[1/4] Cập nhật danh sách gói hệ thống..."
sudo apt update -y

echo "[2/4] Cài đặt Python 3, Chromium, Xvfb và mDNS (avahi-daemon)..."
sudo apt install -y python3 python3-pip git chromium-browser xvfb pulseaudio alsa-utils avahi-daemon
sudo systemctl enable avahi-daemon 2>/dev/null || true
sudo systemctl start avahi-daemon 2>/dev/null || true

echo "[3/4] Cài đặt các thư viện Python..."
pip3 install -r requirements.txt --break-system-packages 2>/dev/null || pip3 install -r requirements.txt

echo "[4/4] Cấp quyền thực thi cho các script..."
chmod +x run_linux.sh setup_nanopi.sh install_service.sh 2>/dev/null || true

echo ""
echo "======================================================================"
echo "  [+] CÀI ĐẶT HOÀN TẤT THÀNH CÔNG TRÊN NANOPi M4!"
echo "  [+] Để chạy ngay, bạn gõ lệnh:"
echo "      ./run_linux.sh"
echo "======================================================================"
