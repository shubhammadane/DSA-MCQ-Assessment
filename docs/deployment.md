# Deploy frontend on Vercel and backend on Render

```text
Browser → Vercel frontend → Render FastAPI backend → Supabase PostgreSQL
```

## Files and folders

```text
frontend/                       Vercel project root
  .env.example                  Local frontend template
  .env.vercel.example           Vercel environment template
  vercel.json                   Vite build and SPA routes
backend/                        Render service root
  .env                          Existing local configuration, ignored by Git
  .env.example                  Local backend template
  .env.render.example           Render production environment template
  scripts/start-render.sh       Migrate, seed and start the API
  app/                          FastAPI and SQLAlchemy
  alembic/                      Database migrations
render.yaml                     Render backend Blueprint
```

The old `dsa-mcq-platform/backend` folder is now `backend`. Root `main.py`, `app/` and `requirements.txt` are compatibility entry points; both platforms should use the app-specific root directories above.

## Which .env goes where?

| Destination | Use this template | What it contains |
| --- | --- | --- |
| Vercel | `frontend/.env.vercel.example` | Only the public Render API URL |
| Render | `backend/.env.render.example` | Supabase connections, backend secrets, administrator settings and Vercel origin |
| Local computer | `backend/.env`, `frontend/.env.local` | Your local development configuration |

`.example` files contain placeholders. Fill their values and paste/import them into the platform's **Environment Variables** settings. Do not commit completed secret files to Git. Real `.env` variants are ignored; example templates are tracked.

### Vercel variables

```dotenv
VITE_API_URL=https://your-backend.onrender.com
```

Use the Render service URL without `/api`; the client adds `/api`. `VITE_` values become browser-visible at build time. The frontend does not need Supabase keys or database credentials. See [Vercel environment variables](https://vercel.com/docs/environment-variables) and [Vite environment handling](https://vite.dev/guide/env-and-mode).

### Render variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Copy your working backend `.env` transaction-pooler URL, port **6543** |
| `MIGRATION_DATABASE_URL` | Copy your working session-pooler URL, port **5432** |
| `SECRET_KEY` | Copy your existing persistent key from `backend/.env` |
| `ADMIN_USERNAME` | `admin`, or your chosen production username |
| `ADMIN_PASSWORD` | A unique production administrator password |
| `FRONTEND_URL` | Exact Vercel origin, e.g. `https://assessment.vercel.app` |
| `ENVIRONMENT` | `production` |
| `PYTHON_VERSION` | `3.14.8` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `120` |
| `EXAM_TIMEZONE` | `Asia/Kolkata` |
| `DB_POOL_SIZE` | `5` |
| `DB_MAX_OVERFLOW` | `5` |
| `DB_POOL_TIMEOUT` | `15` |
| `DB_CONNECT_TIMEOUT` | `10` |

The existing `backend/.env` has verified Supabase credentials. Copy those connection strings rather than reconstructing them. Keep `SECRET_KEY` stable: changing it invalidates login tokens and stored exam-code hashes. `FRONTEND_URL` must have no trailing slash or path. For multiple approved frontend origins, separate them with commas.

## 1. Deploy the backend on Render

Choose either **New → Blueprint** and select this repository's `render.yaml`, or **New → Web Service** with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Language | Python 3 |
| Build Command | `python -m pip install -r requirements.txt` |
| Start Command | `bash scripts/start-render.sh` |
| Health Check Path | `/health/ready` |

In the Render service's **Environment** tab, select **Add from .env** and paste the completed backend production template. Blueprint deployment supplies the non-secret defaults and prompts for the remaining values. Both paths use the same variables. See [Render environment configuration](https://render.com/docs/configure-environment-variables).

If the Vercel domain is not assigned yet, finish backend deployment and update `FRONTEND_URL` in step 3. API health checks do not require a frontend origin.

After deployment, open:

```text
https://your-backend.onrender.com/health/ready
https://your-backend.onrender.com/docs
```

Readiness should return `{"status":"ready"}`. The start script applies pending Alembic migrations and runs idempotent academic seeding before opening the API. It does not replace existing students, exams or results. Migrations run at startup because a separate [Render pre-deploy command](https://render.com/docs/deploys#pre-deploy-command) requires a paid service.

## 2. Deploy the frontend on Vercel

Import the same repository into Vercel and set:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Node.js Version | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Add `VITE_API_URL` with the actual Render URL under the project's environment variables. Apply it to **Production**, and to **Preview** if you want preview builds to use that backend. Then deploy. The checked-in `frontend/vercel.json` handles SPA deep links. See [Vercel's Vite deployment guide](https://vercel.com/docs/frameworks/frontend/vite).

When changing `VITE_API_URL`, redeploy the frontend so Vite embeds the new value.

## 3. Connect the two domains

Copy Vercel's assigned production domain into Render's `FRONTEND_URL` and save/redeploy the backend:

```dotenv
FRONTEND_URL=https://your-frontend.vercel.app
```

Open `https://your-frontend.vercel.app/admin/login` and sign in with the Render `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Refresh `/admin/exams` to verify SPA routing, then create a draft examination and check its question count.

Preview deployment domains are different origins. Add only the preview origins you intend to use to Render's comma-separated `FRONTEND_URL`; production configuration does not automatically authorize every preview domain.

## Updating the repository

An existing Render service must change its Root Directory from `dsa-mcq-platform/backend` to `backend`, and its Start Command to `bash scripts/start-render.sh`. The Vercel root stays `frontend`. Commit and push the restructured source, deployment files and example templates; real `.env` files stay local.

## Exam availability on free hosting

Render Free services sleep after 15 minutes without inbound traffic and can take about a minute to restart. Open the backend readiness endpoint before a scheduled assessment and rehearse on the deployed backend. The previous 80-student test used this Supabase Free project with a local backend; it does not measure Render Free's CPU or cold starts. See [Render Free service limits](https://render.com/docs/free).
