"""WSGI entry point (Gunicorn, `flask --app wsgi:app`)."""
from app import create_app

app = create_app()
