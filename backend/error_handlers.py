"""JSON error responses for the API. Registered by create_app() and by the
test fixtures, so tests see the same responses as production."""

import os
import traceback

from flask import jsonify
from marshmallow import ValidationError as SchemaValidationError
from werkzeug.exceptions import HTTPException

from exceptions import APIException, ValidationError


def register_error_handlers(app):
    @app.errorhandler(SchemaValidationError)
    def handle_schema_validation_error(e):
        # schema.load() on a malformed body: 400 with the per-field messages
        return jsonify({
            "error": "Invalid request data",
            "code": 4001,
            "status": 400,
            "fields": e.messages,
        }), 400

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



def _unauthorized(message):
    return jsonify({"error": message, "code": 401, "status": 401}), 401


def register_jwt_handlers(jwt_manager):
    """Answer every token problem with a 401 in the API's error format.

    Flask-JWT-Extended answers a malformed token with 422 and uses a `msg`
    field. The SPA logs the user out on 401, so all of these must be 401.
    """

    @jwt_manager.unauthorized_loader
    def missing_token(reason):
        return _unauthorized("Authentification requise")

    @jwt_manager.invalid_token_loader
    def invalid_token(reason):
        return _unauthorized("Jeton d'authentification invalide")

    @jwt_manager.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return _unauthorized("Session expirée, veuillez vous reconnecter")
