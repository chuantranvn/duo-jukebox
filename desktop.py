"""
DuoJukebox Desktop Application Launcher
Khởi chạy DuoJukebox dưới dạng Native Desktop Application (Cửa sổ Windows)
sử dụng Edge WebView2 qua pywebview.
"""

import os
import sys
import time
import socket
import threading
import urllib.request
import traceback
import webview

try:
    if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

APP_DIR = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(APP_DIR, "desktop.log")

def log(msg):
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass

from app import app, socketio, PORT, LOCAL_IP

def wait_for_server(url, timeout=10.0):
    """Đợi đến khi server sẵn sàng nhận request."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.2)
    return False

def start_backend():
    """Chạy Flask + SocketIO backend trong background daemon thread."""
    try:
        import logging
        log_w = logging.getLogger('werkzeug')
        log_w.setLevel(logging.ERROR)
        log(f"Khởi động SocketIO backend tại 0.0.0.0:{PORT}...")
        socketio.run(app, host='0.0.0.0', port=PORT, debug=False, allow_unsafe_werkzeug=True)
    except Exception as e:
        log("LỖI BACKEND: " + traceback.format_exc())

def main():
    server_url = f"http://127.0.0.1:{PORT}/player"

    # Khởi động Backend trong thread riêng
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()

    # Đợi server sẵn sàng
    wait_for_server(f"http://127.0.0.1:{PORT}/api/status")

    # Khởi tạo cửa sổ Desktop Application
    window = webview.create_window(
        title="DuoJukebox — Web Music Server Cho Vợ Chồng",
        url=server_url,
        width=1340,
        height=840,
        min_size=(980, 650),
        resizable=True,
        text_select=True,
        zoomable=True
    )

    # Bắt đầu vòng lặp sự kiện Desktop App (Edge WebView2 trên Windows)
    webview.start(gui='edgechromium', debug=False)

    # Khi người dùng đóng cửa sổ app, thoát hoàn toàn
    sys.exit(0)

if __name__ == '__main__':
    try:
        log("=== DuoJukebox Desktop khởi động ===")
        main()
    except Exception as e:
        log("CRASH MAIN: " + traceback.format_exc())
