import os
import traceback

from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from extensions import db, jwt, mail
from models import *
from routes import register_routes
from werkzeug.exceptions import HTTPException
from exceptions import (
    APIException,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError
)
from tasks.scheduler import init_scheduler

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialiser le scheduler
    with app.app_context():
        scheduler = init_scheduler(app)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": ["http://localhost:8080", "http://localhost:3000", "http://127.0.0.1:8080"],
                "supports_credentials": True,
                "allow_headers": ["Content-Type", "Authorization"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "max_age": 3600
            }
        }
    )
    
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app) 

    # ---------------------------------------------------------
    # Allow OPTIONS requests (CORS preflight) to bypass JWT
    # ---------------------------------------------------------
    @app.before_request
    def handle_preflight():
        from flask import request
        if request.method == 'OPTIONS':
            return '', 204

    # ---------------------------------------------------------
    # Global error handler for custom API exceptions
    # ---------------------------------------------------------
    @app.errorhandler(APIException)
    def handle_api_exception(e):
        is_dev = (
            os.getenv("FLASK_ENV") == "development"
            or app.debug is True
            or app.config.get("DEBUG") is True
        )

        payload = {
            "error": e.message,
            "code": e.code,
            "status": e.status_code
        }

        if is_dev:
            payload["type"] = type(e).__name__
            payload["trace"] = traceback.format_exc()

        return jsonify(payload), e.status_code

    # ---------------------------------------------------------
    # Global error handler for ValidationError specifically
    # ---------------------------------------------------------
    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        is_dev = (
            os.getenv("FLASK_ENV") == "development"
            or app.debug is True
            or app.config.get("DEBUG") is True
        )

        payload = {
            "error": e.message,
            "code": e.code,
            "status": e.status_code
        }

        if is_dev:
            payload["type"] = type(e).__name__
            payload["trace"] = traceback.format_exc()

        return jsonify(payload), e.status_code

    # ---------------------------------------------------------
    # Global error handler for HTTP exceptions
    # ---------------------------------------------------------
    @app.errorhandler(HTTPException)
    def handle_http_exception(e):
        is_dev = (
            os.getenv("FLASK_ENV") == "development"
            or app.debug is True
            or app.config.get("DEBUG") is True
        )

        payload = {
            "error": e.description or str(e),
            "code": e.code,
            "status": e.code,
            "name": e.name
        }

        if is_dev:
            payload["trace"] = traceback.format_exc()

        return jsonify(payload), e.code

    # ---------------------------------------------------------
    # Global error handler for all other exceptions
    # ---------------------------------------------------------
    @app.errorhandler(Exception)
    def handle_exception(e):
        is_dev = (
            os.getenv("FLASK_ENV") == "development"
            or app.debug is True
            or app.config.get("DEBUG") is True
        )

        status_code = getattr(e, 'status_code', 500)
        error_code = getattr(e, 'code', status_code)
        error_message = getattr(e, 'message', str(e))

        payload = {
            "error": error_message,
            "code": error_code,
            "status": status_code
        }

        if is_dev:
            payload["type"] = type(e).__name__
            payload["trace"] = traceback.format_exc()

        return jsonify(payload), status_code

    with app.app_context():
        db.create_all()

    register_routes(app)

    # Arrêter le scheduler proprement à la fermeture
    import atexit
    atexit.register(lambda: scheduler.shutdown())
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=True)

