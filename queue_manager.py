import uuid
import time
import json
import os
import sys
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

if getattr(sys, 'frozen', False):
    APP_DIR = os.path.dirname(sys.executable)
else:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))
from local_db import local_db

PROFILES = [
    {"id": "husband", "name": "Chồng", "icon": "👨", "color": "#3b82f6", "badge": "bg-blue-600"},
    {"id": "wife", "name": "Vợ", "icon": "👩", "color": "#ec4899", "badge": "bg-pink-600"},
    {"id": "guest", "name": "Khách", "icon": "🎉", "color": "#10b981", "badge": "bg-emerald-600"},
]

class QueueManager:
    def _record_history(self, song):
        if not song:
            return
        try:
            local_db.add_history(song)
        except Exception as e:
            logger.error(f"Failed to record history: {e}")

    def __init__(self):
        self.queue = []            # list of song dicts
        self.current_song = None   # dict or None
        self.history = []          # last played songs
        self.playback_state = "stopped"  # "playing", "paused", "stopped"
        self.volume = int(local_db.get_setting("app_volume", 80))
        self.current_time = 0
        self.duration = 0
        self.fair_play_mode = True  # Alternate husband and wife songs
        self.radio_mode = False     # Autoplay related songs when queue is empty
        self.last_played_by = None  # Who added the song that was just played
        self.has_active_player = False
        self.load_favorites()

    def get_profile(self, user_id):
        for p in PROFILES:
            if p["id"] == user_id:
                return p
        return {"id": user_id, "name": user_id.capitalize(), "icon": "👤", "color": "#6b7280", "badge": "bg-gray-600"}

    def add_song(self, song_data: dict, user_id: str = "husband", mode: str = "bottom", user_info: dict = None):
        """
        Add a song to queue.
        mode:
          - 'bottom': add to queue (rebalanced if fair_play_mode is on)
          - 'next': add right to top of queue
          - 'now': play immediately
        """
        if user_info:
            profile = {
                "id": user_id,
                "name": user_info.get("name", user_id),
                "icon": user_info.get("icon", "👤"),
                "color": user_info.get("color", "#ec4899")
            }
        else:
            profile = self.get_profile(user_id)

        song = {
            "uid": str(uuid.uuid4())[:8],
            "id": song_data.get("id"),
            "title": song_data.get("title", "Không rõ tiêu đề"),
            "artist": song_data.get("artist", "YouTube"),
            "duration": song_data.get("duration", "--:--"),
            "duration_seconds": song_data.get("duration_seconds", 0),
            "thumbnail": song_data.get("thumbnail"),
            "url": song_data.get("url"),
            "added_by": user_id,
            "added_by_name": profile["name"],
            "added_by_icon": profile["icon"],
            "added_by_color": profile["color"],
            "added_at": int(time.time()),
            "source": song_data.get("source", "youtube"),
            "is_priority": False
        }

        if mode == "now":
            if self.current_song:
                self.history.insert(0, self.current_song)
                if len(self.history) > 50:
                    self.history.pop()
            self.current_song = song
            self.playback_state = "playing"
            self.current_time = 0
            self.last_played_by = user_id
            self._record_history(song)
            return song, "now"

        if mode == "next":
            self.queue.insert(0, song)
            return song, "next"

        # mode == 'bottom'
        if not self.current_song:
            self.current_song = song
            self.playback_state = "playing"
            self.current_time = 0
            self.last_played_by = user_id
            self._record_history(song)
            return song, "now"

        self.queue.append(song)
        if self.fair_play_mode:
            self.rebalance_fair_play()
        return song, "bottom"

    def rebalance_fair_play(self):
        """
        Rebalances the queue in a fair round-robin fashion between contributors.
        If Husband has [H1, H2, H3] and Wife has [W1, W2], queue becomes:
        [H1, W1, H2, W2, H3] (or prioritizes the other person if last played was Husband).
        """
        if len(self.queue) <= 1:
            return

        # Group songs by added_by preserving their order
        user_buckets = defaultdict(list)
        users_order = []
        for song in self.queue:
            u = song["added_by"]
            if u not in users_order:
                users_order.append(u)
            user_buckets[u].append(song)

        # If only one user in queue, nothing to interleave
        if len(users_order) <= 1:
            return

        # If the last played song was by users_order[0], rotate users_order so the other person goes first
        if self.last_played_by and users_order[0] == self.last_played_by and len(users_order) > 1:
            users_order = users_order[1:] + [users_order[0]]

        # Round-robin interleaving
        new_queue = []
        max_len = max(len(bucket) for bucket in user_buckets.values())
        for i in range(max_len):
            for u in users_order:
                if i < len(user_buckets[u]):
                    new_queue.append(user_buckets[u][i])

        self.queue = new_queue

    def next_song(self):
        """Advance to next song in queue. Prioritizes a marked priority song if present."""
        if self.current_song:
            self.history.insert(0, self.current_song)
            if len(self.history) > 50:
                self.history.pop()

        if self.queue:
            # Check if there is any song marked with is_priority
            priority_idx = next((i for i, s in enumerate(self.queue) if s.get("is_priority")), None)
            if priority_idx is not None:
                self.current_song = self.queue.pop(priority_idx)
                self.current_song["is_priority"] = False
            else:
                self.current_song = self.queue.pop(0)

            self.playback_state = "playing"
            self.current_time = 0
            self.last_played_by = self.current_song.get("added_by")
            self._record_history(self.current_song)
        elif self.radio_mode:
            # Queue is empty, but Radio Mode is ON: auto-pick related song
            from yt_service import get_radio_recommendations
            history_ids = [s.get("id") for s in self.history[:30] if s.get("id")]
            ref_song = self.history[0] if self.history else None
            rec = get_radio_recommendations(ref_song, history_ids=history_ids, limit=6)
            if rec:
                radio_song = {
                    "uid": str(uuid.uuid4())[:8],
                    "id": rec["id"],
                    "title": rec.get("title", "Radio Song"),
                    "artist": rec.get("artist", "YouTube"),
                    "duration": rec.get("duration", "--:--"),
                    "duration_seconds": rec.get("duration_seconds", 0),
                    "thumbnail": rec.get("thumbnail"),
                    "url": rec.get("url"),
                    "added_by": "radio",
                    "added_by_name": "Radio Tự Động 📻",
                    "added_by_icon": "📻",
                    "added_by_color": "#a855f7",
                    "added_at": int(time.time()),
                    "source": "radio",
                    "is_priority": False
                }
                self.current_song = radio_song
                self.playback_state = "playing"
                self.current_time = 0
                self.last_played_by = "radio"
                self._record_history(self.current_song)
            else:
                self.current_song = None
                self.playback_state = "stopped"
                self.current_time = 0
        else:
            self.current_song = None
            self.playback_state = "stopped"
            self.current_time = 0
        return self.current_song

    def prev_song(self):
        """Go back to previous song in history."""
        if self.history:
            prev = self.history.pop(0)
            if self.current_song:
                self.queue.insert(0, self.current_song)
            self.current_song = prev
            self.playback_state = "playing"
            self.current_time = 0
            self.last_played_by = self.current_song.get("added_by")
        return self.current_song

    def remove_from_queue(self, uid: str):
        self.queue = [s for s in self.queue if s["uid"] != uid]
        if self.fair_play_mode:
            self.rebalance_fair_play()

    def move_to_top(self, uid: str):
        song = next((s for s in self.queue if s["uid"] == uid), None)
        if song:
            self.queue.remove(song)
            self.queue.insert(0, song)

    def reorder_queue(self, from_index: int, to_index: int):
        if 0 <= from_index < len(self.queue) and 0 <= to_index < len(self.queue):
            song = self.queue.pop(from_index)
            self.queue.insert(to_index, song)

    def clear_queue(self):
        self.queue = []

    def toggle_fair_play(self):
        self.fair_play_mode = not self.fair_play_mode
        if self.fair_play_mode:
            self.rebalance_fair_play()
        return self.fair_play_mode

    def toggle_priority(self, uid: str):
        """
        Toggles priority status for a song in the queue.
        At most one song can have priority at a time.
        """
        target_song = next((s for s in self.queue if s["uid"] == uid), None)
        if not target_song:
            return None
        
        current_val = target_song.get("is_priority", False)
        new_val = not current_val
        
        # Clear priority on all songs first
        for s in self.queue:
            s["is_priority"] = False
            
        target_song["is_priority"] = new_val
        return target_song

    def toggle_radio_mode(self):
        self.radio_mode = not self.radio_mode
        return self.radio_mode

    def set_volume(self, vol: int):
        self.volume = max(0, min(100, int(vol)))
        local_db.set_setting("app_volume", self.volume)

    def set_state(self, state: str):
        if state in ["playing", "paused", "stopped"]:
            self.playback_state = state

    def update_progress(self, current_time: float, duration: float):
        self.current_time = current_time
        if duration > 0:
            self.duration = duration

    def get_state(self):
        return {
            "current_song": self.current_song,
            "queue": self.queue,
            "queue_count": len(self.queue),
            "history": self.history[:10],
            "playback_state": self.playback_state,
            "volume": self.volume,
            "current_time": self.current_time,
            "duration": self.duration,
            "fair_play_mode": self.fair_play_mode,
            "radio_mode": self.radio_mode,
            "has_active_player": self.has_active_player,
            "profiles": PROFILES
        }

    # Local NoSQL Database Delegations
    def load_favorites(self):
        pass  # Managed by local_db

    def save_favorites(self):
        pass  # Managed by local_db

    def get_favorites(self, user_id: str):
        return local_db.get_favorites(user_id)

    def add_favorite(self, user_id: str, song: dict):
        return local_db.add_favorite(user_id, song)

    def remove_favorite(self, user_id: str, song_id: str):
        return local_db.remove_favorite(user_id, song_id)

    def is_favorite(self, user_id: str, song_id: str):
        return local_db.is_favorite(user_id, song_id)

    def get_history(self, limit: int = 50):
        return local_db.get_history(limit)
