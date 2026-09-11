"""
DuoJukebox - API Routes
REST API endpoints for search, queue management, playback control, favorites, and history.
"""
import time
import logging

from flask import Blueprint, request, jsonify

from yt_service import search_youtube
from local_db import local_db

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__)

# These will be set by app.py after initialization
_qm = None
_socketio = None
_last_next_time = [0.0]  # mutable container for module-level state


def init_api(queue_manager, socketio_instance):
    """Initialize API module with shared dependencies."""
    global _qm, _socketio
    _qm = queue_manager
    _socketio = socketio_instance


def _broadcast_state():
    _socketio.emit("state_update", _qm.get_state())


# ================= API: SEARCH =================

@api_bp.route("/api/search")
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

@api_bp.route("/api/status")
def api_status():
    return jsonify(_qm.get_state())


@api_bp.route("/api/queue/add", methods=["POST"])
def api_queue_add():
    data = request.json or {}
    song_data = data.get("song")
    user_id = data.get("user_id", "husband")
    mode = data.get("mode", "bottom")  # 'bottom', 'next', 'now'

    if not song_data or not song_data.get("id"):
        return jsonify({"error": "Missing song data"}), 400

    user_info = data.get("user_info")
    song, action = _qm.add_song(song_data, user_id=user_id, mode=mode, user_info=user_info)

    # Broadcast to all clients
    _broadcast_state()
    if action == "now":
        _socketio.emit("player_play_song", {"song": song})

    return jsonify({"success": True, "song": song, "action": action, "state": _qm.get_state()})


@api_bp.route("/api/queue/remove", methods=["POST"])
def api_queue_remove():
    data = request.json or {}
    uid = data.get("uid")
    if uid:
        _qm.remove_from_queue(uid)
        _broadcast_state()
    return jsonify({"success": True, "state": _qm.get_state()})


@api_bp.route("/api/queue/move_top", methods=["POST"])
def api_queue_move_top():
    data = request.json or {}
    uid = data.get("uid")
    if uid:
        _qm.move_to_top(uid)
        _broadcast_state()
    return jsonify({"success": True, "state": _qm.get_state()})


@api_bp.route("/api/queue/reorder", methods=["POST"])
def api_queue_reorder():
    data = request.json or {}
    from_idx = data.get("from_index")
    to_idx = data.get("to_index")
    if from_idx is not None and to_idx is not None:
        _qm.reorder_queue(int(from_idx), int(to_idx))
        _broadcast_state()
    return jsonify({"success": True, "state": _qm.get_state()})


@api_bp.route("/api/queue/clear", methods=["POST"])
def api_queue_clear():
    _qm.clear_queue()
    _broadcast_state()
    return jsonify({"success": True, "state": _qm.get_state()})


@api_bp.route("/api/queue/toggle_fair_play", methods=["POST"])
def api_toggle_fair_play():
    new_val = _qm.toggle_fair_play()
    _broadcast_state()
    return jsonify({"success": True, "fair_play_mode": new_val, "state": _qm.get_state()})


@api_bp.route("/api/queue/toggle_priority", methods=["POST"])
def api_queue_toggle_priority():
    data = request.json or {}
    uid = data.get("uid")
    if uid:
        _qm.toggle_priority(uid)
        _broadcast_state()
    return jsonify({"success": True, "state": _qm.get_state()})


@api_bp.route("/api/queue/toggle_radio", methods=["POST"])
def api_toggle_radio():
    new_val = _qm.toggle_radio_mode()
    _broadcast_state()
    return jsonify({"success": True, "radio_mode": new_val, "state": _qm.get_state()})


# ================= API: PLAYBACK CONTROLS =================

@api_bp.route("/api/control/play", methods=["POST"])
def api_control_play():
    _qm.set_state("playing")
    _socketio.emit("player_cmd", {"command": "play"})
    _broadcast_state()
    return jsonify({"success": True, "state": _qm.get_state()})


@api_bp.route("/api/control/pause", methods=["POST"])
def api_control_pause():
    _qm.set_state("paused")
    _socketio.emit("player_cmd", {"command": "pause"})
    _broadcast_state()
    return jsonify({"success": True, "state": _qm.get_state()})


@api_bp.route("/api/control/next", methods=["POST"])
def api_control_next():
    now = time.time()
    if now - _last_next_time[0] < 0.3:
        return jsonify({"success": True, "debounced": True, "current_song": _qm.current_song, "state": _qm.get_state()})
    _last_next_time[0] = now

    next_song = _qm.next_song()
    if next_song:
        logger.info(f"⏭️ Next song: {next_song.get('title')} ({next_song.get('id')})")
        _socketio.emit("player_play_song", {"song": next_song})
    else:
        logger.info("⏭️ Next song: queue empty, stopping")
        _socketio.emit("player_cmd", {"command": "stop"})
    _broadcast_state()
    return jsonify({"success": True, "current_song": next_song, "state": _qm.get_state()})


@api_bp.route("/api/control/prev", methods=["POST"])
def api_control_prev():
    prev_song = _qm.prev_song()
    if prev_song:
        logger.info(f"⏮️ Prev song: {prev_song.get('title')} ({prev_song.get('id')})")
        _socketio.emit("player_play_song", {"song": prev_song})
    _broadcast_state()
    return jsonify({"success": True, "current_song": prev_song, "state": _qm.get_state()})


@api_bp.route("/api/control/volume", methods=["POST"])
def api_control_volume():
    data = request.json or {}
    vol = data.get("volume", 80)
    _qm.set_volume(vol)
    _socketio.emit("player_cmd", {"command": "set_volume", "volume": _qm.volume})
    _broadcast_state()
    return jsonify({"success": True, "volume": _qm.volume})


@api_bp.route("/api/control/seek", methods=["POST"])
def api_control_seek():
    data = request.json or {}
    seconds = data.get("seconds", 0)
    _socketio.emit("player_cmd", {"command": "seek", "seconds": seconds})
    return jsonify({"success": True, "seconds": seconds})


# ================= API: FAVORITES =================

@api_bp.route("/api/favorites")
def api_get_favorites():
    user_id = request.args.get("user_id", "husband")
    return jsonify(_qm.get_favorites(user_id))


@api_bp.route("/api/favorites/toggle", methods=["POST"])
def api_toggle_favorite():
    data = request.json or {}
    user_id = data.get("user_id", "husband")
    song = data.get("song")
    if not song or not song.get("id"):
        return jsonify({"error": "Invalid song"}), 400

    song_id = song["id"]
    existing = any(f["id"] == song_id for f in _qm.get_favorites(user_id))
    if existing:
        _qm.remove_favorite(user_id, song_id)
        is_fav = False
    else:
        _qm.add_favorite(user_id, song)
        is_fav = True
    return jsonify({"success": True, "is_favorite": is_fav, "favorites": _qm.get_favorites(user_id)})


@api_bp.route("/api/client_log", methods=["POST"])
def api_client_log():
    data = request.json or {}
    logger.info(f"{data.get('msg')}")
    return jsonify({"status": "ok"})


# ================= API: PLAYBACK HISTORY (NOSQL) =================

@api_bp.route("/api/history")
def api_get_history():
    limit = int(request.args.get("limit", 50))
    return jsonify(local_db.get_history(limit))
