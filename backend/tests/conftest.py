import os

import pytest

# config.py refuses to load without a JWT key outside development; modules that
# import it (init_db, services) need one. test_secure_defaults removes it itself.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
from flask import Flask
from flask_jwt_extended import JWTManager
from error_handlers import register_error_handlers
from routes.auth_routes import auth_bp

@pytest.fixture()
def app():
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    JWTManager(app)
    # Same JSON error responses as create_app()
    register_error_handlers(app)

    app.register_blueprint(auth_bp)
    return app

@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(scope="session")
def seeded_database(tmp_path_factory):
    """Fresh-install reference data, built once per test session into a file."""
    from extensions import db
    from tests.helpers import build_app, seed_reference_data

    path = tmp_path_factory.mktemp("seed") / "seed.db"
    app = build_app(database_uri=f"sqlite:///{path.as_posix()}")
    with app.app_context():
        db.create_all()
        seed_reference_data()
        db.session.remove()
        db.engine.dispose()
    return path


@pytest.fixture()
def seeded(seeded_database, tmp_path):
    """All blueprints, error handlers and fresh-install reference data, plus one
    account per role. Each test gets its own copy of the seeded database.
    Yields a tests.helpers.Api."""
    import shutil

    from extensions import db
    from tests.helpers import Api, build_app

    database = tmp_path / "test.db"
    shutil.copy(seeded_database, database)
    app = build_app(upload_folder=str(tmp_path / "profiles"), database_uri=f"sqlite:///{database.as_posix()}")
    with app.app_context():
        yield Api(app.test_client())
        db.session.remove()
        db.engine.dispose()
