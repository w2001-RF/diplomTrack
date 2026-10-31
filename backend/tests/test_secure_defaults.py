import importlib
import sys

import pytest
from flask import Flask

from extensions import db
from models import User
from utils.security import verify_password


def _load_config(monkeypatch, **env):
    for key in ("JWT_SECRET_KEY", "FLASK_ENV"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    sys.modules.pop("config", None)
    return importlib.import_module("config")


def test_missing_jwt_secret_refuses_to_start_in_production(monkeypatch):
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        _load_config(monkeypatch, FLASK_ENV="production")


def test_missing_jwt_secret_allowed_in_development(monkeypatch):
    config = _load_config(monkeypatch, FLASK_ENV="development")
    assert config.Config.JWT_SECRET_KEY


def test_jwt_secret_from_environment(monkeypatch):
    config = _load_config(monkeypatch, JWT_SECRET_KEY="from-env")
    assert config.Config.JWT_SECRET_KEY == "from-env"


@pytest.fixture()
def db_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    db.init_app(app)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def _seed_admin(monkeypatch, **env):
    monkeypatch.setenv("FLASK_ENV", "development")  # init_db imports config
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    import init_db
    monkeypatch.setattr(init_db.AuditService, "log_action", lambda **kwargs: None)
    init_db.seed_admin_user()
    return User.query.filter_by(username="admin").one()


def test_admin_password_from_environment(db_app, monkeypatch):
    admin = _seed_admin(monkeypatch, ADMIN_PASSWORD="Chosen-Pass-42")

    assert verify_password("Chosen-Pass-42", admin.password_hash)
    assert admin.must_reset_password is True


def test_admin_password_is_random_when_unset(db_app, monkeypatch):
    admin = _seed_admin(monkeypatch)

    assert not verify_password("123456", admin.password_hash)
    assert admin.must_reset_password is True
