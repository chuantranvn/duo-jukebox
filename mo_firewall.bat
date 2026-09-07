@echo off
chcp 65001 > nul
title Mở Tường Lửa Windows - DuoJukebox

:: Kiểm tra quyền Admin, nếu chưa có thì tự gọi UAC
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Đang yêu cầu cấp quyền Administrator...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo =========================================================
echo    DuoJukebox - Mở Port 5000 trên Tường Lửa Windows
echo =========================================================
echo.
echo [*] Đang thêm quy tắc cho phép kết nối Port 5000...

netsh advfirewall firewall add rule name="DuoJukebox" dir=in action=allow protocol=TCP localport=5000

echo.
echo =========================================================
echo  [THÀNH CÔNG] Đã mở Port 5000 trên Windows Firewall!
echo  Điện thoại của bạn và vợ giờ đã có thể quét mã QR
echo  và truy cập vào DuoJukebox một cách mượt mà.
echo =========================================================
echo.
pause
