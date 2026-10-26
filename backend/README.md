# FastAPI backend — Render

This folder is the Render service's **Root Directory**. It contains the API, SQLAlchemy models, Alembic migrations, requirements and deployment scripts.

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Runtime | Python 3.14.8 |
| Build Command | `python -m pip install -r requirements.txt` |
| Start Command | `bash scripts/start-render.sh` |
| Health Check Path | `/health/ready` |
| Production variables | `.env.render.example` |

`start-render.sh` runs migrations and academic seeding before starting one Uvicorn worker. A failed migration stops startup. The script works on Render Free, which does not provide a separate pre-deploy command.

For local development, copy `.env.example` to `.env`, configure it and run:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Your existing local `.env` was preserved when this folder moved. On Render, import the completed `.env.render.example` values as environment variables. Database URLs, the persistent signing key and administrator credentials belong only to this backend.

See [the complete deployment guide](../docs/deployment.md) for deployment order, environment variables and domain configuration.
