#!/usr/bin/env bash
# ======================================================================
#   🎵 DuoJukebox - Linux / NanoPi M4 Auto Launcher (Cross-Platform) 🎵
# ======================================================================

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "======================================================================"
echo "    🎵 DUOJUKEBOX - LINUX & NANOPi M4 MUSIC SERVER 🎵"
echo "======================================================================"
echo ""

# 1. Kiểm tra Python 3
if ! command -v python3 &> /dev/null; then
    echo "[!] Lỗi: Không tìm thấy python3 trên hệ thống!"
    echo "    Vui lòng cài đặt: sudo apt update && sudo apt install -y python3 python3-pip"
    exit 1
fi

# 2. Kiểm tra nhanh thư viện Python (chỉ cài nếu còn thiếu để khởi động siêu tốc)
if ! python3 -c "import flask, flask_socketio, yt_dlp, tinydb" &>/dev/null; then
    echo "[*] Phát hiện thiếu thư viện, đang cài đặt..."
    python3 -m pip install -r requirements.txt --quiet || true
fi

# 3. Khởi động Flask + SocketIO Backend
echo "[*] Đang khởi động DuoJukebox Backend tại cổng 5000..."
python3 app.py &
APP_PID=$!

# Hàm dọn dẹp khi bấm Ctrl+C hoặc tắt service
cleanup() {
    echo ""
    echo "[*] Đang dừng DuoJukebox..."
    kill $APP_PID 2>/dev/null || true
    kill $BROWSER_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Đợi server sẵn sàng
sleep 2

# 4. Tìm trình duyệt Chromium / Chrome để phát âm thanh YouTube ra Loa
BROWSER_BIN=""
for b in chromium-browser chromium google-chrome; do
    if command -v "$b" &> /dev/null; then
        BROWSER_BIN="$b"
        break
    fi
done

PLAYER_URL="http://localhost:5000/player"

if [ -n "$BROWSER_BIN" ]; then
    echo "[*] Tìm thấy trình duyệt: $BROWSER_BIN"
    
    # Nếu có màn hình đồ họa (Desktop GUI / HDMI)
    if [ -n "$DISPLAY" ]; then
        echo "[+] Phát hiện màn hình ($DISPLAY). Đang mở trình duyệt trực tiếp..."
        "$BROWSER_BIN" --autoplay-policy=no-user-gesture-required --no-sandbox "$PLAYER_URL" &
        BROWSER_PID=$!
    else
        # Nếu là Headless (Chỉ có dòng lệnh Terminal)
        if command -v xvfb-run &> /dev/null; then
            echo "[+] Chạy chế độ Headless Terminal qua màn hình ảo Xvfb..."
            echo "[+] Âm thanh tự động xuất ra cổng jack 3.5mm / Loa ngoài!"
            xvfb-run -a "$BROWSER_BIN" --autoplay-policy=no-user-gesture-required --no-sandbox "$PLAYER_URL" &
            BROWSER_PID=$!
        else
            echo "[!] Cảnh báo: Chưa cài đặt 'xvfb' để chạy ngầm không cần màn hình."
            echo "    Chỉ cần gõ: sudo apt install -y xvfb"
            echo "    Tạm thời bạn có thể mở $PLAYER_URL từ một thiết bị khác."
        fi
    fi
else
    echo "[!] Chưa cài đặt Chromium trên NanoPi."
    echo "    Để loa tự hát trên NanoPi, gõ: sudo apt install -y chromium-browser xvfb"
    echo "    Sau đó chạy lại script này!"
fi

echo ""
echo "======================================================================"
echo "  [+] DuoJukebox đang chạy thành công!"
echo "  [+] Người dùng có thể quét QR hoặc truy cập từ điện thoại/máy tính:"
echo "      http://$(hostname -I | awk '{print $1}'):5000"
echo "  [+] Nhấn Ctrl+C để dừng."
echo "======================================================================"

# Giữ script sống
wait $APP_PID
