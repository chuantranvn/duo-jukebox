import os
import sys
import io
import socket
import logging

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
import time
from flask import Flask, render_template, request, jsonify, send_file
from flask_socketio import SocketIO, emit
import qrcode

from yt_service import search_youtube, get_video_details
from queue_manager import QueueManager, PROFILES
from local_db import local_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
app = Flask(
    __name__, 
    template_folder=os.path.join(BASE_DIR, "templates"), 
    static_folder=os.path.join(BASE_DIR, "static")
)
app.config["SECRET_KEY"] = "duo-jukebox-secret-key-2026"
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
qm = QueueManager()
last_next_time = 0.0
active_players = set()

def get_local_ip():
    """Finds primary local Wi-Fi / LAN IP of the host machine."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't actually send packets, just finds routing interface
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

PORT = 5000
LOCAL_IP = get_local_ip()

# ================= HTTP ROUTES =================

@app.route("/")
def index():
    """Remote control interface for phones / tablets."""
    return render_template("index.html", local_ip=LOCAL_IP, port=PORT, profiles=PROFILES)

@app.route("/player")
def player():
    """TV / PC Host player interface connected to speakers."""
    return render_template("player.html", local_ip=LOCAL_IP, port=PORT, profiles=PROFILES)

@app.route("/qr")
def qr_code():
    """Returns a high-contrast QR code image pointing to the remote control URL."""
    remote_url = f"http://{LOCAL_IP}:{PORT}"
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=3
    )
    qr.add_data(remote_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#000000", back_color="#ffffff")
    
    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    return send_file(img_io, mimetype='image/png')

@app.route("/api/info")
def server_info():
    return jsonify({
        "local_ip": LOCAL_IP,
        "port": PORT,
        "remote_url": f"http://{LOCAL_IP}:{PORT}",
        "player_url": f"http://{LOCAL_IP}:{PORT}/player"
    })

# ================= API: SEARCH =================

@app.route("/api/search")
def api_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])
    # Check NoSQL search cache first for instant response
    cached = local_db.get_cached_search(query)
    if cached is not None:
        return jsonify(cached)
    results = search_youtube(query, limit=12)
    if results:
        local_db.save_cached_search(query, results)
    return jsonify(results)

# ================= API: STATUS & QUEUE =================

@app.route("/api/status")
def api_status():
    return jsonify(qm.get_state())

@app.route("/api/queue/add", methods=["POST"])
def api_queue_add():
    data = request.json or {}
    song_data = data.get("song")
    user_id = data.get("user_id", "husband")
    mode = data.get("mode", "bottom")  # 'bottom', 'next', 'now'

    if not song_data or not song_data.get("id"):
        return jsonify({"error": "Missing song data"}), 400

    user_info = data.get("user_info")
    song, action = qm.add_song(song_data, user_id=user_id, mode=mode, user_info=user_info)
    
    # Broadcast to all clients
    _broadcast_state()
    if action == "now":
        socketio.emit("player_play_song", {"song": song})

    return jsonify({"success": True, "song": song, "action": action, "state": qm.get_state()})

@app.route("/api/queue/remove", methods=["POST"])
def api_queue_remove():
    data = request.json or {}
    uid = data.get("uid")
    if uid:
        qm.remove_from_queue(uid)
        _broadcast_state()
    return jsonify({"success": True, "state": qm.get_state()})

@app.route("/api/queue/move_top", methods=["POST"])
def api_queue_move_top():
    data = request.json or {}
    uid = data.get("uid")
    if uid:
        qm.move_to_top(uid)
        _broadcast_state()
    return jsonify({"success": True, "state": qm.get_state()})

@app.route("/api/queue/reorder", methods=["POST"])
def api_queue_reorder():
    data = request.json or {}
    from_idx = data.get("from_index")
    to_idx = data.get("to_index")
    if from_idx is not None and to_idx is not None:
        qm.reorder_queue(int(from_idx), int(to_idx))
        _broadcast_state()
    return jsonify({"success": True, "state": qm.get_state()})

@app.route("/api/queue/clear", methods=["POST"])
def api_queue_clear():
    qm.clear_queue()
    _broadcast_state()
    return jsonify({"success": True, "state": qm.get_state()})

@app.route("/api/queue/toggle_fair_play", methods=["POST"])
def api_toggle_fair_play():
    new_val = qm.toggle_fair_play()
    _broadcast_state()
    return jsonify({"success": True, "fair_play_mode": new_val, "state": qm.get_state()})

# ================= API: PLAYBACK CONTROLS =================

@app.route("/api/control/play", methods=["POST"])
def api_control_play():
    qm.set_state("playing")
    socketio.emit("player_cmd", {"command": "play"})
    _broadcast_state()
    return jsonify({"success": True, "state": qm.get_state()})

@app.route("/api/control/pause", methods=["POST"])
def api_control_pause():
    qm.set_state("paused")
    socketio.emit("player_cmd", {"command": "pause"})
    _broadcast_state()
    return jsonify({"success": True, "state": qm.get_state()})

@app.route("/api/control/next", methods=["POST"])
def api_control_next():
    global last_next_time
    now = time.time()
    if now - last_next_time < 0.3:
        return jsonify({"success": True, "debounced": True, "current_song": qm.current_song, "state": qm.get_state()})
    last_next_time = now

    next_song = qm.next_song()
    if next_song:
        logger.info(f"⏭️ Next song: {next_song.get('title')} ({next_song.get('id')})")
        socketio.emit("player_play_song", {"song": next_song})
    else:
        logger.info("⏭️ Next song: queue empty, stopping")
        socketio.emit("player_cmd", {"command": "stop"})
    _broadcast_state()
    return jsonify({"success": True, "current_song": next_song, "state": qm.get_state()})

@app.route("/api/control/prev", methods=["POST"])
def api_control_prev():
    prev_song = qm.prev_song()
    if prev_song:
        logger.info(f"⏮️ Prev song: {prev_song.get('title')} ({prev_song.get('id')})")
        socketio.emit("player_play_song", {"song": prev_song})
    _broadcast_state()
    return jsonify({"success": True, "current_song": prev_song, "state": qm.get_state()})

@app.route("/api/control/volume", methods=["POST"])
def api_control_volume():
    data = request.json or {}
    vol = data.get("volume", 80)
    qm.set_volume(vol)
    socketio.emit("player_cmd", {"command": "set_volume", "volume": qm.volume})
    _broadcast_state()
    return jsonify({"success": True, "volume": qm.volume})

@app.route("/api/control/seek", methods=["POST"])
def api_control_seek():
    data = request.json or {}
    seconds = data.get("seconds", 0)
    socketio.emit("player_cmd", {"command": "seek", "seconds": seconds})
    return jsonify({"success": True, "seconds": seconds})

# ================= API: FAVORITES =================

@app.route("/api/favorites")
def api_get_favorites():
    user_id = request.args.get("user_id", "husband")
    return jsonify(qm.get_favorites(user_id))

@app.route("/api/favorites/toggle", methods=["POST"])
def api_toggle_favorite():
    data = request.json or {}
    user_id = data.get("user_id", "husband")
    song = data.get("song")
    if not song or not song.get("id"):
        return jsonify({"error": "Invalid song"}), 400

    song_id = song["id"]
    existing = any(f["id"] == song_id for f in qm.get_favorites(user_id))
    if existing:
        qm.remove_favorite(user_id, song_id)
        is_fav = False
    else:
        qm.add_favorite(user_id, song)
        is_fav = True
    return jsonify({"success": True, "is_favorite": is_fav, "favorites": qm.get_favorites(user_id)})

@app.route("/api/client_log", methods=["POST"])
def api_client_log():
    data = request.json or {}
    logger.info(f"{data.get('msg')}")
    return jsonify({"status": "ok"})

# ================= API: PLAYBACK HISTORY (NOSQL) =================

@app.route("/api/history")
def api_get_history():
    limit = int(request.args.get("limit", 50))
    return jsonify(local_db.get_history(limit))

# ================= SOCKET.IO EVENTS =================

def _broadcast_state():
    socketio.emit("state_update", qm.get_state())

@socketio.on("connect")
def handle_connect():
    emit("state_update", qm.get_state())

@socketio.on("register_player")
def handle_register_player():
    active_players.add(request.sid)
    qm.has_active_player = True
    logger.info(f"Host Player registered: {request.sid} (Total: {len(active_players)})")
    _broadcast_state()

@socketio.on("disconnect")
def handle_disconnect():
    if request.sid in active_players:
        active_players.remove(request.sid)
        qm.has_active_player = len(active_players) > 0
        logger.info(f"Host Player disconnected: {request.sid} (Remaining: {len(active_players)})")
        _broadcast_state()

@socketio.on("request_state")
def handle_request_state():
    emit("state_update", qm.get_state())

@socketio.on("player_progress")
def handle_player_progress(data):
    current_time = data.get("current_time", 0)
    duration = data.get("duration", 0)
    qm.update_progress(current_time, duration)
    # Broadcast to remotes
    emit("sync_progress", {"current_time": current_time, "duration": duration}, broadcast=True, include_self=False)

@socketio.on("player_song_ended")
def handle_player_song_ended():
    global last_next_time
    now = time.time()
    # Anti-cascade guard: require at least 2.5 seconds between automatic song transitions
    if now - last_next_time < 2.5:
        logger.warning("Bỏ qua player_song_ended trùng lặp hoặc nhảy liên tiếp (< 2.5s)")
        return
    last_next_time = now

    next_song = qm.next_song()
    if next_song:
        emit("player_play_song", {"song": next_song}, broadcast=True)
    else:
        emit("player_cmd", {"command": "stop"}, broadcast=True)
    _broadcast_state()

@socketio.on("player_state_change")
def handle_player_state_change(data):
    st = data.get("state")
    if st in ["playing", "paused", "stopped"]:
        qm.set_state(st)
        emit("state_update", qm.get_state(), broadcast=True)

if __name__ == "__main__":
    print("=" * 60)
    print("  🎵 DUOJUKEBOX - WEB MUSIC SERVER CHO VỢ CHỒNG & GIA ĐÌNH 🎵")
    print("=" * 60)
    print(f"  👉 Màn hình Loa/TV (Host Player): http://{LOCAL_IP}:{PORT}/player")
    print(f"  👉 Điều khiển từ Điện thoại (Remote): http://{LOCAL_IP}:{PORT}")
    print(f"  👉 Chạy trên máy này (Localhost): http://localhost:{PORT}")
    print("=" * 60)
    socketio.run(app, host="0.0.0.0", port=PORT, debug=False, allow_unsafe_werkzeug=True)
