import sys
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(__file__))

from queue_manager import QueueManager
from yt_service import extract_video_id, search_youtube

def test_queue_fair_play():
    print("--- 1. Kiểm tra Thuật toán Fair-Play (Xen kẽ Chồng - Vợ) ---")
    qm = QueueManager()
    qm.queue = []
    qm.current_song = None
    qm.fair_play_mode = True

    # Giả sử Chồng thêm bài H1 (đang phát ngay)
    s1, act1 = qm.add_song({"id": "h1", "title": "Bài Chồng 1"}, user_id="husband")
    assert act1 == "now", "Bài đầu tiên phải phát ngay"
    assert qm.current_song["id"] == "h1"

    # Chồng thêm tiếp H2, H3
    qm.add_song({"id": "h2", "title": "Bài Chồng 2"}, user_id="husband")
    qm.add_song({"id": "h3", "title": "Bài Chồng 3"}, user_id="husband")

    # Vợ thêm W1
    qm.add_song({"id": "w1", "title": "Bài Vợ 1"}, user_id="wife")

    # Với Fair-Play ON, vì bài đang phát là của Chồng, nên bài tiếp theo sẽ là của Vợ (w1), rồi tới Chồng (h2), rồi tới Chồng (h3)
    queue_ids = [s["id"] for s in qm.queue]
    print(f"Hàng đợi sau khi Vợ thêm bài: {queue_ids}")
    assert queue_ids == ["w1", "h2", "h3"], f"Fair-play thất bại, kết quả: {queue_ids}"

    # Vợ thêm tiếp W2 -> Xen kẽ vòng 1 (w1, h2), vòng 2 (w2, h3)
    qm.add_song({"id": "w2", "title": "Bài Vợ 2"}, user_id="wife")
    queue_ids = [s["id"] for s in qm.queue]
    print(f"Hàng đợi sau khi Vợ thêm tiếp bài 2: {queue_ids}")
    assert queue_ids == ["w1", "h2", "w2", "h3"], f"Fair-play thất bại, kết quả: {queue_ids}"

    # Chuyển bài tiếp theo (phải là w1 của Vợ)
    next_s = qm.next_song()
    assert next_s["id"] == "w1"
    assert qm.last_played_by == "wife"

    # Chuyển tiếp (phải là h2 của Chồng)
    next_s2 = qm.next_song()
    assert next_s2["id"] == "h2"
    assert qm.last_played_by == "husband"

    print("✅ Thuật toán Fair-Play hoạt động chuẩn xác 100%!")

def test_favorites():
    print("\n--- 2. Kiểm tra Danh sách Yêu thích ---")
    qm = QueueManager()
    qm.add_favorite("husband", {"id": "song123", "title": "Bài tủ của Chồng"})
    favs = qm.get_favorites("husband")
    assert any(f["id"] == "song123" for f in favs)
    qm.remove_favorite("husband", "song123")
    favs2 = qm.get_favorites("husband")
    assert not any(f["id"] == "song123" for f in favs2)
    print("✅ Quản lý Favorites hoạt động tốt!")

def test_yt_extract():
    print("\n--- 3. Kiểm tra Trích xuất Link YouTube ---")
    assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert extract_video_id("dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    print("✅ Trích xuất YouTube ID chuẩn xác!")

def test_nosql_storage():
    print("\n--- 4. Kiểm tra NoSQL TinyDB (Lịch sử phát nhạc & Bộ đệm) ---")
    from local_db import local_db
    test_song = {"id": "test_nosql_song", "title": "Bài hát NoSQL Test", "artist": "Duo Jukebox"}
    local_db.add_history(test_song)
    hist = local_db.get_history(5)
    assert any(h["id"] == "test_nosql_song" for h in hist), "Lịch sử NoSQL phải chứa test_nosql_song"
    
    local_db.save_cached_search("bolero trữ tình", [{"id": "b1", "title": "Bolero"}])
    cached = local_db.get_cached_search("bolero trữ tình")
    assert cached is not None and len(cached) == 1, "Cache tìm kiếm NoSQL phải trả về kết quả ngay"
    print("✅ NoSQL Local Database (TinyDB) lưu trữ và truy vấn cực nhanh!")

if __name__ == "__main__":
    test_queue_fair_play()
    test_favorites()
    test_yt_extract()
    test_nosql_storage()
    print("\n🎉 TẤT CẢ CÁC BÀI TEST ĐÃ VƯỢT QUA THÀNH CÔNG!")
