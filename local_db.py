"""
DuoJukebox Local NoSQL Database Engine (TinyDB)
Lưu trữ tài nguyên dạng Document NoSQL chuẩn tại thư mục ứng dụng (duo_database.json).
Quản lý: favorites, playback_history, search_cache, app_settings.
Zero external server, 100% offline & local disk persistence (phong cách Zalo).
"""

import os
import sys
import time
import json
from tinydb import TinyDB, Query, where

if getattr(sys, 'frozen', False):
    APP_DIR = os.path.dirname(sys.executable)
else:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(APP_DIR, "duo_database.json")
LEGACY_FAV_FILE = os.path.join(APP_DIR, "favorites.json")


class DuoLocalDB:
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self.db = TinyDB(self.db_path, ensure_ascii=False, indent=2, encoding="utf-8")
        self.fav_table = self.db.table("favorites")
        self.history_table = self.db.table("playback_history")
        self.cache_table = self.db.table("search_cache")
        self.settings_table = self.db.table("app_settings")
        
        # Tự động import dữ liệu từ favorites.json cũ nếu bảng favorites trong TinyDB còn trống
        self._migrate_legacy_favorites()

    def _migrate_legacy_favorites(self):
        try:
            if len(self.fav_table) == 0 and os.path.exists(LEGACY_FAV_FILE):
                with open(LEGACY_FAV_FILE, "r", encoding="utf-8") as f:
                    legacy_data = json.load(f)
                
                migrated_count = 0
                for user_id, songs in legacy_data.items():
                    for s in songs:
                        item = {
                            "user_id": user_id,
                            "id": s.get("id"),
                            "title": s.get("title", ""),
                            "artist": s.get("artist", ""),
                            "thumbnail": s.get("thumbnail", ""),
                            "duration": s.get("duration", "--:--"),
                            "duration_seconds": s.get("duration_seconds", 0),
                            "url": s.get("url", ""),
                            "added_at": s.get("added_at", int(time.time()))
                        }
                        self.fav_table.insert(item)
                        migrated_count += 1
                if migrated_count > 0:
                    print(f"[DuoLocalDB] Migrated {migrated_count} legacy favorites into TinyDB!")
        except Exception as e:
            print(f"[DuoLocalDB] Legacy migration error: {e}")

    # ================= FAVORITES (YÊU THÍCH) =================
    def get_favorites(self, user_id: str):
        """Lấy danh sách bài hát yêu thích của user_id."""
        Item = Query()
        results = self.fav_table.search(Item.user_id == user_id)
        # Sắp xếp bài mới thêm lên đầu
        results.sort(key=lambda x: x.get("added_at", 0), reverse=True)
        return results

    def is_favorite(self, user_id: str, song_id: str) -> bool:
        Item = Query()
        return self.fav_table.contains((Item.user_id == user_id) & (Item.id == song_id))

    def add_favorite(self, user_id: str, song: dict):
        """Thêm bài hát vào favorites nếu chưa tồn tại."""
        if not self.is_favorite(user_id, song.get("id")):
            doc = {
                "user_id": user_id,
                "id": song.get("id"),
                "title": song.get("title", ""),
                "artist": song.get("artist", ""),
                "thumbnail": song.get("thumbnail", ""),
                "duration": song.get("duration", "--:--"),
                "duration_seconds": song.get("duration_seconds", 0),
                "url": song.get("url", ""),
                "added_at": int(time.time())
            }
            self.fav_table.insert(doc)
            return True
        return False

    def remove_favorite(self, user_id: str, song_id: str):
        Item = Query()
        removed = self.fav_table.remove((Item.user_id == user_id) & (Item.id == song_id))
        return len(removed) > 0

    # ================= PLAYBACK HISTORY (LỊCH SỬ PHÁT NHẠC) =================
    def add_history(self, song: dict):
        """Lưu bài hát vừa phát vào lịch sử NoSQL."""
        if not song or not song.get("id"):
            return
        doc = {
            "id": song.get("id"),
            "uid": song.get("uid", ""),
            "title": song.get("title", ""),
            "artist": song.get("artist", ""),
            "thumbnail": song.get("thumbnail", ""),
            "duration": song.get("duration", "--:--"),
            "duration_seconds": song.get("duration_seconds", 0),
            "url": song.get("url", ""),
            "added_by": song.get("added_by", ""),
            "added_by_name": song.get("added_by_name", ""),
            "added_by_icon": song.get("added_by_icon", "👤"),
            "played_at": int(time.time())
        }
        self.history_table.insert(doc)

        # Giữ tối đa 500 bài trong lịch sử NoSQL để file luôn gọn gàng
        if len(self.history_table) > 500:
            all_docs = self.history_table.all()
            all_docs.sort(key=lambda x: x.get("played_at", 0))
            excess = len(all_docs) - 500
            for old_doc in all_docs[:excess]:
                self.history_table.remove(doc_ids=[old_doc.doc_id])

    def get_history(self, limit: int = 50):
        """Lấy danh sách bài hát đã phát gần đây."""
        docs = self.history_table.all()
        docs.sort(key=lambda x: x.get("played_at", 0), reverse=True)
        return docs[:limit]

    # ================= SEARCH CACHE (BỘ ĐỆM TÌM KIẾM) =================
    def get_cached_search(self, query_str: str, max_age_seconds: int = 86400):
        """Lấy kết quả tìm kiếm đã cache nếu còn hạn (mặc định 24h)."""
        q = query_str.strip().lower()
        Item = Query()
        found = self.cache_table.get(Item.query == q)
        if found:
            cached_at = found.get("cached_at", 0)
            if time.time() - cached_at < max_age_seconds:
                return found.get("results", [])
            else:
                # Quá hạn thì xóa
                self.cache_table.remove(doc_ids=[found.doc_id])
        return None

    def save_cached_search(self, query_str: str, results: list):
        """Lưu kết quả tìm kiếm vào cache NoSQL."""
        q = query_str.strip().lower()
        Item = Query()
        doc = {
            "query": q,
            "results": results,
            "cached_at": int(time.time())
        }
        self.cache_table.upsert(doc, Item.query == q)

    # ================= APP SETTINGS =================
    def get_setting(self, key: str, default=None):
        Item = Query()
        found = self.settings_table.get(Item.key == key)
        return found.get("value", default) if found else default

    def set_setting(self, key: str, value):
        Item = Query()
        self.settings_table.upsert({"key": key, "value": value}, Item.key == key)


# Singleton instance
local_db = DuoLocalDB()
