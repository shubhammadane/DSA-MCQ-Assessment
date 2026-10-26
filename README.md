# College Examination & MCQ Assessment Platform

A full-stack examination platform for department-scoped question banks, student assignments, timed MCQ examinations, audit logs and result management. The application uses React, TypeScript and Tailwind CSS on the frontend, with FastAPI, SQLAlchemy, Alembic and PostgreSQL on the backend.

## Deployment

Deploy **frontend/** on **Vercel**, **backend/** on **Render**, and use the existing **Supabase** database. The complete setup, exact commands and environment-variable mapping are in [docs/deployment.md](docs/deployment.md).

| Platform | Project root | Environment template |
| --- | --- | --- |
| Vercel | `frontend` | [frontend/.env.vercel.example](frontend/.env.vercel.example) |
| Render | `backend` | [backend/.env.render.example](backend/.env.render.example) |

The live local backend configuration is now `backend/.env`. Example files contain placeholders; real secrets stay in the platforms' environment-variable settings.

## Main capabilities

- Role-based administration for super administrators and department HODs.
- Department, program, academic-year, semester and subject management.
- Student creation and secure bulk import from CSV, XLSX or text-based PDF roll lists.
- Unique temporary passwords generated during bulk import and downloaded once as CSV.
- Question-bank management with subject and department boundaries.
- Reviewed question import from CSV, XLSX or text-based PDF files.
- Random or manual question selection for each examination.
- Student-specific exam assignment and one-attempt enforcement.
- Server-side examination timers, scheduling and automatic timeout submission.
- A new random session access code for every examination sitting. Generating a new code invalidates the old code.
- Marks-based scoring, configurable passing percentage and delayed answer-review release.
- Security-event logging for tab changes, fullscreen exits, copying and pasting.
- Authenticated Excel and CSV result exports.
- Safe archival and dependency-aware deletion of academic records.

## Secure examination flow

1. An administrator creates students manually or imports a roll list.
2. Temporary student credentials are distributed securely.
3. The administrator creates an exam, assigns students and configures its schedule.
4. Immediately before the sitting, the administrator selects **Create Code** or **New Code** for that exam.
5. The generated eight-digit code is displayed once. Only its keyed hash is stored.
6. A student signs in, opens an assigned exam and enters the current session code.
7. The backend verifies the student, assignment, schedule, code and attempt ownership before serving questions.

For a high-stakes examination, rotate the code shortly before the sitting and do not send it through a public group. The shared session code supplements the student's individual login; it does not replace it.

## Import formats

### Student import

CSV and XLSX files require these columns:

```text
enrollment_no,name,gender
BT26F05F001,Student Name,Male
```

Text-based PDF roll lists are also supported when each record contains a recognizable enrollment number followed by the student's name and optional gender. Scanned PDFs can use OCR when Poppler (`pdftoppm`) and Tesseract are installed on the backend; OCR is limited to 15 pages per upload. Imports are limited to 5 MB, 5,000 rows and 100 PDF pages.

Existing students are not modified unless the operator explicitly enables updating, and an HOD cannot move a student from another department. Newly generated temporary passwords appear only in the import response and are downloaded by the frontend.

### Question import

CSV and XLSX files require:

```text
question_text,option_a,option_b,option_c,option_d,correct_answer,marks,difficulty,topic
What is a stack?,FIFO,LIFO,Tree,Graph,B,1,Easy,Data Structures
```

PDF question import recognizes common numbered question layouts, lettered or numbered choices, inline correct answers, and separate answer-key sections or tables. It works best when each question has four choices and the answer key clearly identifies the correct choice. For example:

```text
1. What is a stack?
A. FIFO structure
B. LIFO structure
C. Tree structure
D. Graph structure
Answer: B
```

The import screen always previews the parsed questions and errors before confirmation. PDF extraction is best effort because PDF layouts vary; scanned files require Poppler and Tesseract, and the assessment schema supports four choices (A-D). Check extracted wording and answers in the preview. The importer rejects missing fields, invalid answer keys, duplicate options, duplicate questions and questions already present in the selected subject. Imported questions are never published without administrator confirmation.

## Project layout

```text
backend/
├── alembic/versions/       Database migrations
├── app/api.py              API endpoints and authorization
├── app/auth.py             JWT and password authentication
├── app/config.py           Environment configuration
├── app/database.py         SQLAlchemy engine and sessions
├── app/importers.py        Bounded student and question parsers
├── app/main.py             FastAPI application and initial seed
├── app/models.py           Database models
└── app/schemas.py          Request and response validation

frontend/src/
├── pages/                  Student and administrator screens
├── services/api.ts         Authenticated API client
├── App.tsx                 Lazy-loaded application routes
└── types.ts                Shared TypeScript types
```

## Local setup

### 1. Configure PostgreSQL or Supabase

Create a database and copy the example configuration:

```bash
createdb dsa_mcq_db
cp -n backend/.env.example backend/.env
```

Set a strong, unique `SECRET_KEY` and `ADMIN_PASSWORD` in the backend `.env`. Do not reuse the example placeholder values. `EXAM_TIMEZONE` controls how exam date/time fields are interpreted and defaults to `Asia/Kolkata`.

For Supabase, open the project's **Connect** panel and set these values in `backend/.env`:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@POOLER_HOST:6543/postgres?sslmode=require
MIGRATION_DATABASE_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5
DB_POOL_TIMEOUT=15
DB_CONNECT_TIMEOUT=10
```

Copy the actual hostname and username from **Transaction pooler** for runtime and **Session pooler** for migrations. Direct connections can be used for migrations on hosts with IPv6 connectivity. The shared pooler supports IPv4. Keep connection strings exclusively on the backend; no Supabase keys are required in the React frontend. See [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).

Use the database password without the placeholder square brackets. Reserved password characters are normalized automatically. `python check_database.py` verifies both connections and reports common failures without printing credentials.

SQLAlchemy is the Python ORM; Alembic manages its schema migrations. The existing FastAPI application uses these directly with Supabase PostgreSQL. Each worker has at most 10 pooled database connections with the defaults above. Student sessions share these short database transactions; they do not each hold a connection for the duration of an exam.

Migration `008_supabase_table_privacy` enables RLS on application tables without public policies. FastAPI must connect as the table owner (the `postgres` user supplied by Connect) or an appropriately privileged backend role. Browser Data API roles cannot read assessment tables or answer keys. See [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

### 2. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python seed_academic.py
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API documentation is available at `http://127.0.0.1:8000/docs`.

When transferring an existing local SQLite installation into a freshly migrated PostgreSQL project, stop the local backend and run `python migrate_local_data.py --source sqlite:////absolute/path/to/local.db` before restarting it on PostgreSQL. The utility copies student passwords and assessment records in one transaction, remaps foreign keys, and merges bundled seed data. It refuses destinations that already contain user records.

### 3. Start the frontend

```bash
cd frontend
npm install
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

Open `http://127.0.0.1:5173`. Administrator login is at `/admin/login`; credentials come exclusively from the configured environment variables.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL SQLAlchemy connection URL |
| `MIGRATION_DATABASE_URL` | Direct or session-pooler migration URL; defaults to `DATABASE_URL` |
| `DB_POOL_SIZE` | Retained connections per worker; default 5 |
| `DB_MAX_OVERFLOW` | Additional burst connections per worker; default 5 |
| `DB_POOL_TIMEOUT` | Seconds to wait for a pool connection; default 15 |
| `DB_CONNECT_TIMEOUT` | PostgreSQL connection timeout in seconds; default 10 |
| `SECRET_KEY` | Persistent random key used to sign JWTs and hash exam codes |
| `ADMIN_USERNAME` | Environment super-administrator username |
| `ADMIN_PASSWORD` | Strong environment super-administrator password |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime; default is 120 minutes |
| `FRONTEND_URL` | Comma-separated allowed frontend origins |
| `EXAM_TIMEZONE` | Timezone used for exam schedules |
| `ENVIRONMENT` | Set to `production` in production deployments |

Production startup fails if `SECRET_KEY` or `ADMIN_PASSWORD` is missing. CORS accepts only configured and local development origins.

## Testing and verification

```bash
cd frontend
npm run lint
npm run build
npm test

cd ../backend
pip install -r requirements-dev.txt
pytest
python -m compileall app alembic/versions
```

Use an isolated database for any additional backend integration tests; never point destructive test workflows at production.

### Concurrent assessment verification

The PostgreSQL tests run the actual production app in a separate Uvicorn process over HTTP. They create and remove randomly named test schemas. To run them against an isolated test database:

```bash
cd backend
TEST_DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@127.0.0.1:5432/assessment_test \
LOAD_TEST_REPORT=/tmp/assessment-load-test.json \
python -m pytest --disable-warnings -s
```

The 80-student scenario includes real password verification, simultaneous starts, 50 question snapshots per student, five answer batches each, status checks, and simultaneous atomic submissions. It asserts that all 4,000 answers exist and all 80 scores are correct. Another test races 12 starts and 12 submissions for a single student. Migration tests verify upgrades and rollback/re-upgrade while preserving recorded results.

See [the validation report](docs/assessment-validation.md) for measured results and deployment limits.

### Running an examination

Create a subject and add/import enough active questions into that subject, then create the examination. The editor shows the available question count. Manual mode requires exactly the configured number of selected questions. Assign students, publish, and generate a session code before the sitting. Editing, assignment removal, status changes and code rotation are available in Exam Management.

Question selection, marks, duration and academic scope cannot change once a student has started. Existing attempts retain question and mark snapshots. Removing an assignment for a student who has started is blocked. Students receive visible save feedback; changed answers are saved in ordered batches, retained locally during network failures, and retried. Submission saves final answers and calculates the score in one transaction; late answers are rejected using the server deadline.

Transient network and 502/503/504 failures retry up to three times for reads and idempotent student start/save/submit requests. Exam creation and other administrator writes are not automatically repeated. PostgreSQL answer updates are batched to reduce hosted round trips; scoring uses a database aggregate instead of reloading question text.

For deployment, `render.yaml` uses your supplied Supabase URLs and one Uvicorn worker with a 200-request concurrency limit. Configure `FRONTEND_URL` and `VITE_API_URL` for the deployed frontend and backend. `/health/live` checks the process and `/health/ready` checks database connectivity.

## Data protection

- Never commit `.env`, database files, exports, credential CSVs or backup JSON files.
- Existing secrets exposed in an earlier repository version should be rotated.
- Removing a backup from the current branch does not erase it from Git history; use an approved history-rewrite process before making a previously exposed repository public.
- Question review defaults to release only after an exam closes, reducing answer-key sharing during an active sitting.
