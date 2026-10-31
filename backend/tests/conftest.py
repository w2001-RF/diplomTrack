import pytest
from flask import Flask
from flask_jwt_extended import JWTManager
from routes.auth_routes import auth_bp 

@pytest.fixture()
def app():
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    JWTManager(app)

    app.register_blueprint(auth_bp)
    return app

@pytest.fixture
def client(app):
    return app.test_client()
