#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Render Free has no pre-deploy command, so migrate before opening the server.
python -m alembic upgrade head
python seed_academic.py

exec python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1 \
  --limit-concurrency 200 \
  --timeout-keep-alive 5
