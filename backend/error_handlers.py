"""JSON error responses for the API. Registered by create_app() and by the
test fixtures, so tests see the same responses as production."""

import os
import traceback

from flask import jsonify
from werkzeug.exceptions import HTTPException

from exceptions import APIException, ValidationError


def register_error_handlers(app):
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
