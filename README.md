# 🎵 DuoJukebox - Web & Desktop Music Server Cho Gia Đình & Bạn Bè

<div align="center">

![DuoJukebox Banner](https://img.shields.io/badge/DuoJukebox-Cyberpunk%20Neon-ec4899?style=for-the-badge&logo=youtube&logoColor=white)
![Version](https://img.shields.io/badge/Version-2.5.0-8b5cf6?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10%20|%203.11%20|%203.12%20|%203.14-3b82f6?style=for-the-badge&logo=python&logoColor=white)
![Flask SocketIO](https://img.shields.io/badge/Flask--SocketIO-Real--Time-06b6d4?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)

**Ứng dụng Music Server hiện đại theo phong cách Cyberpunk Neon dành cho Gia đình, Vợ chồng & Nhóm bạn bè.**  
Nghe nhạc đồng bộ qua YouTube không giới hạn, công bằng tuyệt đối với thuật toán Xen Kẽ Fair-Play, kết nối Phòng Online P2P và điều khiển từ xa bằng điện thoại qua mã QR.

</div>

---

## ✨ Điểm Nổi Bật & Tính Năng Chi Tiết

### 1. ⚖️ Thuật Toán Xen Kẽ Công Bằng (Fair-Play Mode)
- **Tự động đan xen bài hát**: Khi nhiều người cùng thêm nhạc vào hàng đợi, hệ thống tự động sắp xếp theo thứ tự: **Người A ➔ Người B ➔ Người A ➔ Người B...**
- Không ai lo bị "tranh loa" hay bị một người spam bài chiếm sóng cả buổi.
- Có công tắc bật/tắt nhanh giữa chế độ Xen kẽ (Fair-Play) và Tự do (FIFO) trên cả Host Player và Remote điện thoại.

### 2. ⚡ Ưu Tiên Bài Hát (Priority Queue)
- Bạn muốn bài hát mình vừa thêm được phát ngay ở lượt kế tiếp mà không cần xóa hay sắp xếp lại cả hàng đợi?
- Chỉ cần bấm biểu tượng **Tia sét (`⚡`)** trên bài hát đó: Hàng bài sẽ đổi sang viền vàng neon nổi bật cùng huy hiệu phát sáng `⚡ PHÁT TIẾP`.
- Khi bài hiện tại kết thúc, bài ưu tiên sẽ lập tức phát trước, sau đó hệ thống tiếp tục hàng đợi bình thường.

### 3. 📻 Chế Độ Radio Tự Động Nối Bài (Autoplay Related Songs)
- **Cuộc vui không bao giờ gián đoạn**: Khi hàng đợi đã phát hết sạch bài và Radio = BẬT, hệ thống tự động phân tích ca sĩ/thể loại bài vừa nghe và tự động tìm bài hát tương tự phù hợp trên YouTube để nối bài liên tục.
- **Quyền ưu tiên thuộc về người dùng**: Bất cứ khi nào có người thêm bài mới vào hàng đợi, bài của người dùng sẽ luôn được phát trước bài do Radio chọn.
- **Tránh lặp bài**: Tự động lọc bỏ các bài đã nghe gần đây trong lịch sử phát.
- **Dừng sạch sẽ khi Radio = TẮT**: Nếu tắt Radio, hệ thống sẽ dừng phát hoàn toàn khi hết hàng đợi (chặn lỗi tự ý phát lại video cũ của YouTube).

### 4. 🌊 Sóng Nhạc Cyberpunk 60fps (Audio Visualizer) & Bắt Nhịp Loa Qua Micro
- **3 Phong cách sóng nhạc đa dạng**:
  - `📊 Cột (Cyberpunk Bars)`: 36 cột tần số gradient rực rỡ (*Cyan ➔ Indigo ➔ Pink Neon*), bo góc mượt mà kèm nốt đỉnh (peak caps) rơi chậm theo trọng lực.
  - `🌊 Sóng (Fluid Wave)`: Các dải sóng âm uốn lượn đa tầng mềm mại (kiểu Apple Music / Siri Wave).
  - `💫 Hào quang Đĩa Than (Vinyl Aura)`: Vòng hào quang sóng âm phát xung tỏa tròn quanh đĩa than khi ở chế độ Âm nhạc.
- **2 Chế độ hoạt động thông minh**:
  - *Mặc định (Rhythm Engine)*: Tự động tính toán nhịp điệu sinh động theo tiến trình bài hát, âm lượng và trạng thái phát mà không cần cấp quyền gì.
  - *Loa Mic (Nâng cao)*: Bấm nút `Loa Mic` để kết nối micro phòng khách (Web Audio API `AnalyserNode`), các cột sóng sẽ nhảy 100% theo âm bass, treble thực tế phát ra từ dàn loa ngoài!
- **Đồng bộ trên điện thoại**: Thanh Mini Player và Modal xem bài hát trên điện thoại có cột sóng nhạc mini chuyển động nhịp nhàng theo tiếng nhạc.

### 5. 🌐 Phòng Nghe Nhạc Online 6 Số (WebRTC P2P Room Hub)
- Kết nối bạn bè ở các nơi khác nhau qua Internet vào chung một phòng nghe nhạc chỉ bằng **Mã phòng 6 chữ số** (ví dụ: `849201`).
- Sử dụng mạng ngang hàng WebRTC (Google STUN) + PeerJS: **Không cần mở cổng modem (Port Forwarding)**, không cần thuê máy chủ hay VPS.
- Đồng bộ phát, dừng, tua bài theo thời gian thực (millisecond sync).

### 6. 📱 Remote Điện Thoại Siêu Tiện Lợi (QR Code LAN)
- Mở camera điện thoại quét mã QR hiển thị trên màn hình Host để truy cập ngay giao diện điều khiển.
- Đầy đủ tính năng: Tìm kiếm nhạc YouTube, thêm bài vào hàng đợi, bật/tắt Fair-Play & Radio, chỉnh âm lượng, tua nhạc, kéo thả sắp xếp bài hát, danh sách bài tủ Yêu thích (Favorites).

### 7. 🖼️ Bộ Sưu Tập Hình Nền Cyberpunk Neon & Tự Động Đổi Nền
- Tích hợp sẵn 5 hình nền Cyberpunk Neon 4K sắc nét (DJ Girl, Neon Couple, Concert Stage, Nightclub, Vinyl DJ).
- Chế độ tự động luân phiên đổi hình nền mỗi 35 giây kèm hiệu ứng chuyển cảnh mờ ảo mịn màng.

### 8. 💾 Cơ Sở Dữ Liệu NoSQL Siêu Tốc & An Toàn (TinyDB)
- Lưu trữ cục bộ toàn bộ danh sách Yêu thích, Lịch sử phát nhạc (History), Cài đặt ứng dụng và Bộ nhớ đệm tìm kiếm YouTube (Search Cache).
- Tích hợp khóa luồng `RLock` và cơ chế tự phục hồi ID collision (`_safe_insert`), đảm bảo database chạy bền bỉ 24/7 không bao giờ gây gián đoạn luồng phát nhạc.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu cầu hệ thống
- Hệ điều hành: Windows 10 / 11, macOS, hoặc Linux.
- Python 3.10 trở lên (nếu chạy từ source code).
- Trình duyệt web hiện đại (Google Chrome, Microsoft Edge, Cốc Cốc, Safari...).

### 1. Khởi chạy bằng Python (Đa nền tảng Windows & Linux)
```bash
# 1. Clone repository về máy
git clone https://github.com/chuantranvn/duo-jukebox.git
cd duo-jukebox

# 2. Cài đặt các thư viện cần thiết
pip install -r requirements.txt

# 3. Khởi chạy máy chủ
python app.py
```

> **🪟 Trên Windows**: 
> - Nhấp đúp trực tiếp vào file **`DuoJukebox.exe`** để mở ứng dụng Desktop độc lập.
> - Hoặc nhấp đúp file **`run.bat`** để chạy qua dòng lệnh.

> **🐧 Trên NanoPi M4 / Linux (Ubuntu, Armbian)**:
> - Cài đặt 1 lệnh tự động: `./setup_nanopi.sh`
> - Khởi chạy tự động (hỗ trợ cả Headless Terminal không cần màn hình qua Xvfb): `./run_linux.sh`

### 2. Các địa chỉ truy cập
Khi máy chủ khởi động, màn hình Console sẽ hiển thị các đường dẫn truy cập:
- **Màn hình Loa / TV (Host Player)**: `http://localhost:5000/player` (hoặc `http://<IP-MẠNG-LAN>:5000/player`)
- **Điều khiển bằng Điện thoại (Remote Control)**: `http://<IP-MẠNG-LAN>:5000`

---

## 📖 Hướng Dẫn Sử Dụng Chi Tiết

### Kịch bản 1: Hai vợ chồng / Gia đình nghe nhạc ở nhà
1. Mở máy tính nối dàn loa/TV, chạy `python app.py` và mở trình duyệt vào `http://localhost:5000/player`.
2. Bấm vào màn hình một lần để cấp phép âm thanh (nếu trình duyệt yêu cầu).
3. Hai vợ chồng dùng camera điện thoại quét mã QR hiển thị ở góc trên màn hình máy tính để mở trang Remote.
4. Trên điện thoại:
   - Chồng chọn Profile `👨 Chồng`, Vợ chọn Profile `👩 Vợ`.
   - Tìm kiếm bài hát yêu thích và bấm **`+ Thêm vào hàng đợi`**.
   - Bài hát sẽ được thuật toán Fair-Play tự động xếp xen kẽ và phát ra dàn loa ngoài!

### Kịch bản 2: Nghe nhạc cùng bạn bè ở xa (Phòng Online 6 Số)
1. **Chủ phòng**:
   - Truy cập trang Player hoặc Remote, bấm nút **`Phòng Online`** ở thanh đầu trang.
   - Nhập biệt danh, chọn avatar và bấm **`Tạo Phòng Mới`**.
   - Sao chép mã phòng 6 chữ số (ví dụ: `729104`) và gửi cho bạn bè.
2. **Bạn bè tham gia**:
   - Truy cập trang DuoJukebox trên máy tính hoặc điện thoại của họ.
   - Bấm **`Phòng Online`**, nhập mã 6 số và bấm **`Vào Phòng`**.
   - Bây giờ tất cả mọi người có thể cùng thêm bài, đổi bài và nghe nhạc đồng bộ với nhau!

### Kịch bản 3: Sử dụng các tính năng thông minh
- **Ưu tiên bài hát**: Trong danh sách hàng đợi, bấm vào biểu tượng `⚡` cạnh bài hát để bài đó được ưu tiên phát ngay lượt kế tiếp.
- **Bật Radio nối bài**: Bấm nút `Radio: BẬT` ở góc trên màn hình hoặc gạt công tắc Radio trong tab Hàng đợi của điện thoại.
- **Đổi kiểu sóng nhạc**: Bấm nút `📊 Cột` hoặc `🌊 Sóng` ở thanh điều khiển sóng nhạc; bấm `Loa Mic` nếu muốn sóng nhạc nhảy theo âm thanh thực tế thu từ micro.
- **Đổi hình nền**: Bấm nút `Hình Nền` ở góc trên màn hình để chọn hình nền Cyberpunk yêu thích hoặc bật chế độ tự động đổi nền mỗi 35s.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
duo-jukebox/
├── app.py                 # Entry point khởi động ứng dụng (slim)
├── config.py              # Cấu hình IP, Port, Base dir & hằng số hệ thống
├── queue_manager.py       # Quản lý hàng đợi, thuật toán Fair-Play, Priority & Radio
├── yt_service.py          # Tìm kiếm YouTube & gợi ý bài hát Radio không cần API key
├── local_db.py            # Động cơ NoSQL TinyDB thread-safe (Favorites, History, Cache)
├── sockets.py             # Quản lý toàn bộ WebSocket event handlers (Socket.IO)
├── routes/                # Module hóa REST API và HTML Page routes
│   ├── __init__.py        # Đăng ký Blueprints
│   ├── api.py             # REST API (Search, Queue, Playback control, Favorites)
│   └── pages.py           # Route phục vụ giao diện (/, /player, /qr, /api/info)
├── duo_database.json      # Cơ sở dữ liệu JSON cục bộ lưu trên đĩa
├── test_core.py           # Bộ kiểm thử tự động toàn diện (6 test suites)
├── run.bat                # Script chạy nhanh trên Windows
├── push_to_git.bat        # Script đẩy mã nguồn lên GitHub nhanh
├── templates/
│   ├── player.html        # Giao diện Màn hình TV/PC (Host Player)
│   ├── index.html         # Giao diện Remote điều khiển trên Điện thoại / Tablet
│   └── partials/          # Jinja2 template partials tái sử dụng
│       ├── _player_room_hub_modal.html
│       ├── _player_members_modal.html
│       ├── _player_chat_drawer.html
│       ├── _player_nickname_modal.html
│       ├── _remote_expanded_modal.html
│       ├── _remote_nav.html
│       └── _remote_profile_modal.html
└── static/
    ├── css/
    │   └── style.css      # CSS tùy chỉnh, hoạt ảnh Neon, hiệu ứng đĩa than, Visualizer
    ├── js/
    │   ├── shared/        # Tiện ích và API Client dùng chung
    │   │   ├── utils.js
    │   │   └── api-client.js
    │   ├── player/        # Module chia nhỏ cho Host Player
    │   │   ├── player-core.js       # YouTube iFrame API & playback
    │   │   ├── player-controls.js   # Nút điều khiển phát nhạc
    │   │   ├── player-queue.js      # Danh sách hàng đợi & drag-drop
    │   │   ├── player-search.js     # Tìm kiếm & thêm bài trên TV
    │   │   ├── player-room.js       # WebRTC Room Hub kết nối bạn bè
    │   │   ├── player-chat.js       # Trò chuyện phòng trực tuyến
    │   │   ├── player-wallpaper.js  # Bộ chuyển đổi hình nền Cyberpunk
    │   │   ├── player-visualizer.js # Sóng nhạc Equalizer Canvas 60fps
    │   │   └── player-init.js       # Khởi tạo & gắn kết Socket.IO
    │   ├── remote/        # Module chia nhỏ cho Remote Điện thoại
    │   │   ├── remote-core.js       # Socket, Mini player & Modal
    │   │   ├── remote-search.js     # Tìm kiếm & thêm bài hát
    │   │   ├── remote-queue.js      # Quản lý hàng đợi từ xa
    │   │   ├── remote-favorites.js  # Quản lý danh sách bài tủ
    │   │   └── remote-init.js       # Tab navigation & khởi tạo
    │   ├── room_network.js# Mạng WebRTC P2P Room Hub kết nối bạn bè qua Internet
    │   ├── identity.js    # Quản lý hồ sơ người dùng, nickname và avatar
    │   └── local_store.js # Quản lý NoSQL Dexie IndexedDB trên trình duyệt
    └── images/
        └── bg/            # Bộ sưu tập hình nền Cyberpunk Neon 4K
```

---

## 🧪 Kiểm Thử Tự Động (Automated Tests)

Dự án đi kèm bộ kiểm thử tự động toàn diện kiểm tra 100% các tính năng lõi:
```bash
python test_core.py
```

**Các hạng mục kiểm thử**:
1. ✅ **Thuật toán Fair-Play**: Kiểm tra khả năng xen kẽ chính xác giữa nhiều người dùng.
2. ✅ **Danh sách Yêu thích**: Kiểm tra thêm, xóa và truy vấn Favorites.
3. ✅ **YouTube Extractor**: Kiểm tra trích xuất video ID từ đa dạng định dạng link YouTube.
4. ✅ **NoSQL TinyDB Storage**: Kiểm tra ghi/đọc lịch sử, cache tìm kiếm và chống xung đột ID.
5. ✅ **Priority Queue & Clean Stop**: Kiểm tra phát bài ưu tiên `⚡` bất kể vị trí và dừng sạch sẽ khi hết bài.
6. ✅ **Chế độ Radio Autoplay**: Kiểm tra tự động gợi ý nối bài liên tục và nhường quyền cho người dùng.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: Python, Flask, Flask-SocketIO, Eventlet / Threading, TinyDB NoSQL.
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Vanilla CSS, Tailwind CSS (CDN), Lucide Icons.
- **Audio & Media**: YouTube IFrame API, Web Audio API (`AudioContext`, `AnalyserNode`), HTML5 Canvas 60fps.
- **Networking & P2P**: Socket.IO (WebSockets), WebRTC, PeerJS (Google STUN Servers), QRCode Generator.

---

## 📄 Bản Quyền (License)

Dự án được phân phối dưới giấy phép [MIT License](LICENSE). Hoàn toàn miễn phí cho mục đích cá nhân và gia đình!
