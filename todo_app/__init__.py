"""할 일 앱 패키지. create_app()으로 Flask 앱을 만듭니다."""
from pathlib import Path

from flask import Flask

from .errors import register_error_handlers
from .routes import BLUEPRINTS

# templates/ 와 static/ 은 프로젝트 루트에 그대로 둡니다.
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def create_app():
    app = Flask(
        __name__,
        template_folder=str(PROJECT_ROOT / "templates"),
        static_folder=str(PROJECT_ROOT / "static"),
    )
    for bp in BLUEPRINTS:
        app.register_blueprint(bp)
    register_error_handlers(app)
    return app
