"""
DuoJukebox - Routes Package
Registers all Flask blueprints.
"""
from .pages import pages_bp
from .api import api_bp


def register_routes(app):
    """Register all route blueprints with the Flask app."""
    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp)
