#!/bin/sh
set -e

while ! nc -z postgres 5432; do
  echo "Waiting for Postgres..."
  sleep 2
done

echo "Running database initialization..."
python init_db.py

echo "Starting Gunicorn..."
exec gunicorn -w "${GUNICORN_WORKERS:-6}" -b 0.0.0.0:5000 wsgi:app
