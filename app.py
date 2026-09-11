"""
DuoJukebox - Application Entry Point
Slim entry point that wires all modules together.
"""
import os
import sys
import logging

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from flask import Flask
from flask_socketio import SocketIO

from config import BASE_DIR, PORT, LOCAL_IP, SECRET_KEY
from queue_manager import QueueManager
from routes import register_routes
from routes.api import init_api
from sockets import init_sockets

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ================= APP FACTORY =================

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)
app.config["SECRET_KEY"] = SECRET_KEY
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
qm = QueueManager()

# Wire dependencies
init_api(qm, socketio)
init_sockets(socketio, qm)
register_routes(app)

# ================= MAIN =================

if __name__ == "__main__":
    print("=" * 60)
    print("  🎵 DUOJUKEBOX - WEB MUSIC SERVER CHO VỢ CHỒNG & GIA ĐÌNH 🎵")
    print("=" * 60)
    print(f"  👉 Màn hình Loa/TV (Host Player): http://{LOCAL_IP}:{PORT}/player")
    print(f"  👉 Điều khiển từ Điện thoại (Remote): http://{LOCAL_IP}:{PORT}")
    print(f"  👉 Chạy trên máy này (Localhost): http://localhost:{PORT}")
    print("=" * 60)
    socketio.run(app, host="0.0.0.0", port=PORT, debug=False, allow_unsafe_werkzeug=True)
