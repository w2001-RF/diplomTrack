#!/bin/sh

while ! nc -z postgres 5432; do
  echo "Waiting for Postgres..."
  sleep 2
done

python init_db.py
gunicorn wsgi:app --bind 0.0.0.0:5000

echo "Running database initialization..."
python init_db.py

echo "Starting Gunicorn..."
exec gunicorn -w 6 -b 0.0.0.0:5000 wsgi:app