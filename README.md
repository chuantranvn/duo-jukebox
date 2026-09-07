# 🎵 DuoJukebox - Web & Desktop Music Server Cho Gia Đình & Bạn Bè

Ứng dụng Music Server theo mô hình **Lyrion Music Server (LMS / Squeezebox)**, giúp vợ chồng, gia đình hoặc nhóm bạn cùng nghe nhạc đồng bộ qua YouTube dù sở thích âm nhạc khác nhau.

---

## ✨ Điểm Nổi Bật

1. **Bản Ứng Dụng Desktop Độc Lập (`DuoJukebox.exe`)**:
   - File thực thi Windows `.exe` độc lập (~31 MB), nhấp đúp là chạy ngay.
   - Không yêu cầu cài Python hay môi trường phức tạp.
   - Giao diện cửa sổ Native Windows chạy mượt mà trên Edge WebView2.

2. **Tính Năng Phòng Online Bằng Mã Code (Room Code 6 Số)**:
   - Hỗ trợ 4 người (hoặc nhiều hơn) ở các nơi khác nhau trên Internet kết nối vào chung một phòng nghe nhạc qua mạng ngang hàng WebRTC (Google STUN).
   - Không cần mở cổng modem (Port Forwarding), không cần thuê VPS hay tốn chi phí máy chủ.
   - Đồng bộ phát/dừng nhạc và vị trí bài hát theo thời gian thực (real-time millisecond sync).

3. **Nguồn nhạc YouTube không giới hạn**:
   - Tìm kiếm bài hát, ca sĩ, album hoặc dán link YouTube bất kỳ.
   - Hoàn toàn miễn phí, không cần Google API Key.

4. **Chế độ Xen Kẽ Công Bằng (Fair-Play Mode ⚖️)**:
   - Hệ thống tự động xen kẽ bài hát giữa các thành viên: **Người 1 -> Người 2 -> Người 3 -> Người 4...**
   - Không ai lo bị "tranh loa" hay bị một người spam cả danh sách dài.
   - Có thể bật/tắt nhanh chế độ xen kẽ ngay trên thanh tiêu đề.

5. **Thêm bài trực tiếp hoặc Điều khiển bằng Điện thoại qua QR Code**:
   - Có thanh tìm kiếm và thêm bài trực tiếp ngay trên giao diện máy tính.
   - Khi ở nhà cùng mạng Wi-Fi: Quét mã QR trên màn hình để dùng điện thoại làm Remote điều khiển từ xa.

---

## 🚀 Hướng Dẫn Sử Dụng

### Cách 1: Sử dụng Bản Desktop EXE (Khuyên dùng)
1. Nhấp đúp vào **`DuoJukebox.exe`**.
2. Ứng dụng sẽ tự động khởi động và mở giao diện nghe nhạc.

### Cách 2: Kết nối 4 người ở các nơi khác nhau (Phòng Online 6 Số)
1. **Người 1 (Tạo phòng):**
   - Bấm nút **`Phòng Online`** trên thanh tiêu đề.
   - Nhập tên của bạn, chọn biểu tượng và bấm **`Tạo Phòng Mới`**.
   - Copy mã phòng gồm 6 chữ số (ví dụ: `849201`) gửi cho 3 người bạn.
2. **3 Người còn lại (Vào phòng):**
   - Mở `DuoJukebox.exe` trên máy tính của họ.
   - Bấm **`Phòng Online`**, nhập tên và điền mã 6 chữ số vào ô rồi bấm **`Vào Phòng`**.
3. **Thưởng thức âm nhạc:**
   - Mọi người cùng tìm bài và thêm vào hàng đợi. Nhạc sẽ đồng bộ phát cùng lúc trên loa/tai nghe của cả 4 người!

### Cách 3: Hai vợ chồng dùng chung ở nhà
1. Mở `DuoJukebox.exe` hoặc chạy `run.bat` trên máy tính nối loa/TV.
2. Hai vợ chồng dùng camera điện thoại quét mã QR hiển thị ở nút **`Mã QR`** trên màn hình để mở giao diện điều khiển.
3. Chồng chọn Profile `👨 Chồng`, Vợ chọn Profile `👩 Vợ`.

---

## 📁 Cấu Trúc Dự Án

```
d:\Trần Ngọc Chuẩn\WORK\duo-jukebox/
├── DuoJukebox.exe         # Bản ứng dụng Desktop Windows độc lập
├── desktop.py             # Wrapper Native Desktop (pywebview + Edge Chromium)
├── build_exe.py           # Script build tự động PyInstaller
├── app.py                 # Máy chủ Flask & WebSocket API
├── yt_service.py          # Module tìm kiếm YouTube không cần API key
├── queue_manager.py       # Quản lý hàng đợi & thuật toán xen kẽ Fair-play
├── favorites.json         # Danh sách bài hát yêu thích của từng người
├── run.bat                # Script khởi chạy nhanh bằng Python
├── templates/
│   ├── player.html        # Giao diện màn hình loa/TV phát nhạc & Phòng Online
│   └── index.html         # Giao diện Remote điều khiển trên điện thoại
└── static/
    ├── css/style.css      # Giao diện và hiệu ứng đĩa than
    └── js/
        ├── player.js      # Logic phát YouTube iFrame, điều khiển hàng đợi
        ├── remote.js      # Logic remote điện thoại
        └── room_network.js# Mạng WebRTC P2P Room Code (PeerJS)
```
