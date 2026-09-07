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

def test_priority_queue_and_stop():
    print("\n--- 5. Kiểm tra Chế độ Ưu tiên (Priority Queue) & Dừng khi hết bài ---")
    qm = QueueManager()
    qm.queue = []
    qm.current_song = None
    qm.fair_play_mode = False

    # Thêm bài phát ngay: Current
    s0, _ = qm.add_song({"id": "s0", "title": "Bài Đang Phát"}, mode="now")
    assert qm.current_song["id"] == "s0"

    # Thêm 4 bài vào hàng đợi
    s1, _ = qm.add_song({"id": "s1", "title": "Bài 1"}, mode="bottom")
    s2, _ = qm.add_song({"id": "s2", "title": "Bài 2"}, mode="bottom")
    s3, _ = qm.add_song({"id": "s3", "title": "Bài 3"}, mode="bottom")
    s4, _ = qm.add_song({"id": "s4", "title": "Bài 4"}, mode="bottom")
    assert [s["id"] for s in qm.queue] == ["s1", "s2", "s3", "s4"]

    # Đánh dấu bài 3 (s3, nằm ở vị trí thứ 3 trong queue) là ƯU TIÊN
    qm.toggle_priority(s3["uid"])
    assert s3["is_priority"] == True
    assert s1["is_priority"] == False

    # Khi chuyển bài kế tiếp, bài s3 PHẢI được phát bất kể vị trí của nó
    next_s = qm.next_song()
    assert next_s["id"] == "s3", f"Phải phát bài ưu tiên s3, nhưng lại phát: {next_s['id']}"
    assert [s["id"] for s in qm.queue] == ["s1", "s2", "s4"], "Queue sau khi lấy bài ưu tiên s3 phải còn s1, s2, s4"
    print("✅ Tính năng Ưu tiên bài hát (Priority Queue) hoạt động chuẩn xác 100%!")

    # Phát hết các bài còn lại: s1 -> s2 -> s4
    assert qm.next_song()["id"] == "s1"
    assert qm.next_song()["id"] == "s2"
    assert qm.next_song()["id"] == "s4"

    # Khi hết hàng đợi: next_song() phải trả về None và playback_state = 'stopped'
    last_ended = qm.next_song()
    assert last_ended is None, "Khi hết bài phải trả về None"
    assert qm.current_song is None, "current_song phải là None"
    assert qm.playback_state == "stopped", "playback_state phải là 'stopped'"
    print("✅ Cơ chế dừng phát khi hết hàng đợi hoạt động chuẩn xác 100%!")

def test_radio_mode():
    print("\n--- 6. Kiểm tra Chế độ Radio Tự Động Nối Bài (Autoplay) ---")
    qm = QueueManager()
    qm.queue = []
    qm.history = []
    qm.current_song = None
    qm.radio_mode = False

    # 1. Khi Radio TẮT và queue rỗng -> next_song() trả về None
    assert qm.next_song() is None
    assert qm.playback_state == "stopped"

    # 2. Bật Chế độ Radio
    qm.toggle_radio_mode()
    assert qm.radio_mode == True

    # Giả lập bài hát vừa phát là ca sĩ nổi tiếng
    qm.history = [{"id": "hist_1", "title": "Cơn Mưa Ngang Qua", "artist": "Sơn Tùng M-TP"}]

    # Khi hết bài trong queue, Radio Mode phải tự động tìm bài tương tự và phát
    radio_song = qm.next_song()
    assert radio_song is not None, "Radio mode phải tự động tìm được bài hát nối tiếp"
    assert radio_song["added_by"] == "radio", "Nguồn bài phải là 'radio'"
    assert radio_song["id"] != "hist_1", "Bài Radio không được trùng với bài vừa phát trong history"
    assert qm.playback_state == "playing"
    print(f"✅ Radio mode tự động nối bài thành công: '{radio_song['title']}' ({radio_song['artist']})")

    # 3. Khi người dùng thêm bài thủ công vào queue -> Người dùng phải được ưu tiên trước Radio
    qm.add_song({"id": "user_song_1", "title": "Bài của Người Dùng"}, mode="bottom")
    next_s = qm.next_song()
    assert next_s["id"] == "user_song_1", "Bài của người dùng phải được ưu tiên phát trước bài tự động của Radio"
    print("✅ Ưu tiên bài của người dùng trước Radio hoạt động chuẩn xác 100%!")

if __name__ == "__main__":
    test_queue_fair_play()
    test_favorites()
    test_yt_extract()
    test_nosql_storage()
    test_priority_queue_and_stop()
    test_radio_mode()
    print("\n🎉 TẤT CẢ CÁC BÀI TEST ĐÃ VƯỢT QUA THÀNH CÔNG!")
