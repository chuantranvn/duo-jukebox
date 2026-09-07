@echo off
chcp 65001 > nul
title DuoJukebox - Web Music Server
cd /d "%~dp0"

echo ======================================================================
echo    🎵 CHÀO MỪNG ĐẾN VỚI DUOJUKEBOX - MUSIC SERVER CHO VỢ CHỒNG 🎵
echo ======================================================================
echo.

:: Kiểm tra Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [LỖI] Không tìm thấy Python trên máy tính của bạn!
    echo Vui lòng cài đặt Python từ python.org và đánh dấu "Add Python to PATH".
    pause
    exit /b 1
)

:: Cài đặt thư viện cần thiết nếu chưa có
echo [*] Đang kiểm tra và cài đặt thư viện cần thiết...
python -m pip install -r requirements.txt --quiet

echo.
echo [*] Đang khởi động DuoJukebox Server...
echo.

:: Mở trình duyệt màn hình Player sau 2 giây
start "" cmd /c "timeout /t 2 >nul & start http://localhost:5000/player"

:: Khởi chạy server
python app.py

pause
