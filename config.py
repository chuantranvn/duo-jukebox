"""
DuoJukebox - Application Configuration
Centralized constants and settings.
"""
import os
import sys
import socket

# Base directory (handles PyInstaller frozen builds)
BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))

# Server config
PORT = 5000
SECRET_KEY = "duo-jukebox-secret-key-2026"


def get_local_ip():
    """Finds primary local Wi-Fi / LAN IP of the host machine."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't actually send packets, just finds routing interface
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


LOCAL_IP = get_local_ip()
