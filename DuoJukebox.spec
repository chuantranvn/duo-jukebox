# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_all

BASE_DIR = os.path.dirname(os.path.abspath(SPEC))

datas = [
    (os.path.join(BASE_DIR, "templates"), "templates"),
    (os.path.join(BASE_DIR, "static"), "static"),
]
binaries = []
hiddenimports = [
    "flask",
    "flask_socketio",
    "socketio",
    "engineio",
    "engineio.async_drivers.threading",
    "simple_websocket",
    "wsproto",
    "bidict",
    "jinja2",
    "werkzeug",
    "requests",
    "qrcode",
    "PIL",
    "yt_dlp",
    "webview",
    "pythonnet",
    "clr_loader",
    "cffi",
    "tinydb",
]

# Thu thap Webview
try:
    d, b, h = collect_all("webview")
    datas += d
    binaries += b
    hiddenimports += [
        x for x in h 
        if not x.startswith(("webview.platforms.android", "webview.platforms.cocoa", "webview.platforms.gtk", "webview.platforms.qt"))
    ]
except Exception as e:
    print(f"Warning collecting webview: {e}")

# Thu thap Pythonnet
try:
    d, b, h = collect_all("pythonnet")
    datas += d
    binaries += b
    hiddenimports += h
except Exception as e:
    print(f"Warning collecting pythonnet: {e}")

# Thu thap EngineIO & SocketIO
try:
    d, b, h = collect_all("engineio")
    datas += d
    binaries += b
    hiddenimports += h
except Exception as e:
    pass

try:
    d, b, h = collect_all("socketio")
    datas += d
    binaries += b
    hiddenimports += h
except Exception as e:
    pass

a = Analysis(
    [os.path.join(BASE_DIR, 'desktop.py')],
    pathex=[BASE_DIR],
    binaries=binaries,
    datas=datas,
    hiddenimports=list(set(hiddenimports)),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'unittest'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='DuoJukebox',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
