import os

from tests.conftest import app

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    # ---------------------------
    # General
    # ---------------------------
    USE_MINIO = os.getenv("USE_MINIO", "false").lower() == "true"
    
    # ---------------------------
    # Flask
    # ---------------------------
    DEBUG = os.getenv("FLASK_ENV") == "development"

    # ---------------------------
    # Database
    # ---------------------------
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    if os.getenv("DATABASE_TYPE", "sqlite") == "sqlite":
        data_dir = os.path.join(BASE_DIR, "data")
        os.makedirs(data_dir, exist_ok=True)
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(data_dir, 'diplomtrack.db')}"
    else:
        SQLALCHEMY_DATABASE_URI = os.getenv(
            "DATABASE_URL",
            "postgresql://diplomtrack:diplomtrack@postgres:5432/diplomtrack"
        )

    # ---------------------------
    # JWT
    # ---------------------------
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key")
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 8  # 8 hours

    # ---------------------------
    # MinIO
    # ---------------------------
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
    MINIO_BUCKET = os.getenv("MINIO_BUCKET", "uploads")

    # ---------------------------
    # MAIL Settings
    # ---------------------------
    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 465))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'
    MAIL_USE_SSL = os.getenv('MAIL_USE_SSL', 'false').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', 'wassim.rifay@uit.ac.ma')
    MAIL_MAX_EMAILS = None
    MAIL_ASCII_ATTACHMENTS = False


    # ---------------------------
    # Files Settings
    # ---------------------------
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads/profiles')
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB max
