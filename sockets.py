"""
DuoJukebox - Socket.IO Event Handlers
All WebSocket event handlers for real-time communication.
"""
import time
import logging
from flask import request

logger = logging.getLogger(__name__)

# Module-level state
_qm = None
_socketio = None
_active_players = set()
_last_next_time = [0.0]


def init_sockets(socketio_instance, queue_manager):
    """Initialize socket handlers with shared dependencies."""
    global _qm, _socketio
    _qm = queue_manager
    _socketio = socketio_instance
    _register_handlers()


def _broadcast_state():
    _socketio.emit("state_update", _qm.get_state())


def _register_handlers():

    @_socketio.on("connect")
    def handle_connect():
        from flask_socketio import emit
        emit("state_update", _qm.get_state())

    @_socketio.on("register_player")
    def handle_register_player():
        _active_players.add(request.sid)
        _qm.has_active_player = True
        logger.info(f"Host Player registered: {request.sid} (Total: {len(_active_players)})")
        _broadcast_state()

    @_socketio.on("disconnect")
    def handle_disconnect():
        if request.sid in _active_players:
            _active_players.remove(request.sid)
            _qm.has_active_player = len(_active_players) > 0
            logger.info(f"Host Player disconnected: {request.sid} (Remaining: {len(_active_players)})")
            _broadcast_state()

    @_socketio.on("request_state")
    def handle_request_state():
        from flask_socketio import emit
        emit("state_update", _qm.get_state())

    @_socketio.on("player_progress")
    def handle_player_progress(data):
        from flask_socketio import emit
        current_time = data.get("current_time", 0)
        duration = data.get("duration", 0)
        _qm.update_progress(current_time, duration)
        # Broadcast to remotes
        emit("sync_progress", {"current_time": current_time, "duration": duration}, broadcast=True, include_self=False)

    @_socketio.on("player_song_ended")
    def handle_player_song_ended():
        now = time.time()
        # Anti-cascade guard: require at least 2.5 seconds between automatic song transitions
        if now - _last_next_time[0] < 2.5:
            logger.warning("Bỏ qua player_song_ended trùng lặp hoặc nhảy liên tiếp (<2.5s)")
            return
        _last_next_time[0] = now

        try:
            next_song = _qm.next_song()
            if next_song:
                logger.info(f"📻 Auto-playing next song (song ended): {next_song.get('title')} ({next_song.get('id')})")
                _socketio.emit("player_play_song", {"song": next_song})
            else:
                logger.info("⏹️ Auto-stopping (song ended, queue empty & radio off)")
                _socketio.emit("player_cmd", {"command": "stop"})
            _broadcast_state()
        except Exception as e:
            logger.error(f"Error in handle_player_song_ended: {e}", exc_info=True)

    @_socketio.on("player_state_change")
    def handle_player_state_change(data):
        from flask_socketio import emit
        st = data.get("state")
        if st in ["playing", "paused", "stopped"]:
            _qm.set_state(st)
            emit("state_update", _qm.get_state(), broadcast=True)
