import os

from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from extensions import db, jwt, mail
from models import *
from routes import register_routes
from error_handlers import register_error_handlers
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

    register_error_handlers(app)

    with app.app_context():
        db.create_all()

    register_routes(app)

    # Arrêter le scheduler proprement à la fermeture
    # (None dans les workers qui n'ont pas obtenu le verrou)
    if scheduler:
        import atexit
        atexit.register(lambda: scheduler.shutdown())
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=True)

