#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
# NOTE: Running with a single worker (default). For production with higher traffic,
# consider adding --workers N (e.g., --workers 2 or --workers 4) based on available CPU/memory.
exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips "*"
