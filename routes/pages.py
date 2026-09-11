"""
DuoJukebox - HTML Page Routes
Serves the main web interfaces and utilities.
"""
import io
from flask import Blueprint, render_template, send_file, jsonify
import qrcode

from config import LOCAL_IP, PORT
from queue_manager import PROFILES

pages_bp = Blueprint('pages', __name__)


@pages_bp.route("/")
def index():
    """Remote control interface for phones / tablets."""
    return render_template("index.html", local_ip=LOCAL_IP, port=PORT, profiles=PROFILES)


@pages_bp.route("/player")
def player():
    """TV / PC Host player interface connected to speakers."""
    return render_template("player.html", local_ip=LOCAL_IP, port=PORT, profiles=PROFILES)


@pages_bp.route("/qr")
def qr_code():
    """Returns a high-contrast QR code image pointing to the remote control URL."""
    remote_url = f"http://{LOCAL_IP}:{PORT}"
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=3
    )
    qr.add_data(remote_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#000000", back_color="#ffffff")

    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    return send_file(img_io, mimetype='image/png')


@pages_bp.route("/api/info")
def server_info():
    return jsonify({
        "local_ip": LOCAL_IP,
        "port": PORT,
        "remote_url": f"http://{LOCAL_IP}:{PORT}",
        "player_url": f"http://{LOCAL_IP}:{PORT}/player"
    })
