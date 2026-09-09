#!/usr/bin/env bash
# ======================================================================
#   🎵 DuoJukebox - Cài đặt Dịch vụ Khởi động Cùng Hệ thống (systemd) 🎵
#   Tự động chạy lại khi cắm nguồn hoặc có điện lại sau khi mất điện!
# ======================================================================

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
SERVICE_FILE="/etc/systemd/system/duojukebox.service"
CURRENT_USER="$(whoami)"

echo "======================================================================"
echo "    [*] ĐANG CÀI ĐẶT DỊCH VỤ TỰ ĐỘNG KHỞI ĐỘNG (AUTORUN ON BOOT)"
echo "======================================================================"
echo ""

# Đảm bảo run_linux.sh có quyền thực thi
chmod +x "$DIR/run_linux.sh" "$DIR/setup_nanopi.sh"

echo "[1/3] Tạo file dịch vụ systemd tại $SERVICE_FILE..."
sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=DuoJukebox Music Server Daemon
After=network-online.target sound.target
Wants=network-online.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$DIR
ExecStartPre=/bin/sleep 3
ExecStart=$DIR/run_linux.sh
Restart=always
RestartSec=5
KillMode=mixed

[Install]
WantedBy=multi-user.target
EOF

echo "[2/3] Kích hoạt dịch vụ với hệ thống..."
sudo systemctl daemon-reload
sudo systemctl enable duojukebox.service

echo "[3/3] Khởi chạy dịch vụ DuoJukebox ngay bây giờ..."
sudo systemctl restart duojukebox.service

echo ""
echo "======================================================================"
echo "  [+] ĐÃ CÀI ĐẶT THÀNH CÔNG DỊCH VỤ TỰ KHỞI ĐỘNG!"
echo "  [+] Từ bây giờ:"
echo "      - Mất điện có điện lại: NanoPi tự động bật và phát nhạc."
echo "      - Cắm nguồn / khởi động lại: Tự động chạy nền 100%."
echo "      - Không cần cắm màn hình, bàn phím, hay đăng nhập SSH gì nữa!"
echo ""
echo "  [*] Một số lệnh quản lý tiện ích khi cần:"
echo "      - Xem trạng thái: sudo systemctl status duojukebox"
echo "      - Dừng phát:      sudo systemctl stop duojukebox"
echo "      - Khởi động lại:  sudo systemctl restart duojukebox"
echo "======================================================================"
