# College Examination & MCQ Assessment Platform

A full-stack examination platform for department-scoped question banks, student assignments, timed MCQ examinations, audit logs and result management. The application uses React, TypeScript and Tailwind CSS on the frontend, with FastAPI, SQLAlchemy, Alembic and PostgreSQL on the backend.

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

Text-based PDF roll lists are also supported when each record contains a recognizable enrollment number followed by the student's name and optional gender. Scanned image PDFs must be OCR-processed first. Imports are limited to 5 MB, 5,000 rows and 100 PDF pages.

Existing students are not modified unless the operator explicitly enables updating, and an HOD cannot move a student from another department. Newly generated temporary passwords appear only in the import response and are downloaded by the frontend.

### Question import

CSV and XLSX files require:

```text
question_text,option_a,option_b,option_c,option_d,correct_answer,marks,difficulty,topic
What is a stack?,FIFO,LIFO,Tree,Graph,B,1,Easy,Data Structures
```

For PDF import, use this layout:

```text
1. What is a stack?
A. FIFO structure
B. LIFO structure
C. Tree structure
D. Graph structure
Answer: B
```

The import screen always previews the parsed questions and errors before confirmation. It rejects missing fields, invalid answer keys, duplicate options, duplicate questions and questions already present in the selected subject. Imported questions are never published without administrator confirmation.

## Project layout

```text
dsa-mcq-platform/backend/
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

### 1. Configure PostgreSQL

Create a database and copy the example configuration:

```bash
createdb dsa_mcq_db
cp .env.example dsa-mcq-platform/backend/.env
```

Set a strong, unique `SECRET_KEY` and `ADMIN_PASSWORD` in the backend `.env`. Do not reuse the example placeholder values. `EXAM_TIMEZONE` controls how exam date/time fields are interpreted and defaults to `Asia/Kolkata`.

### 2. Start the backend

```bash
cd dsa-mcq-platform/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python seed_academic.py
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API documentation is available at `http://127.0.0.1:8000/docs`.

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

cd ../dsa-mcq-platform/backend
pip install -r requirements-dev.txt
pytest
python -m compileall app alembic/versions
```

Use an isolated database for any additional backend integration tests; never point destructive test workflows at production.

## Data protection

- Never commit `.env`, database files, exports, credential CSVs or backup JSON files.
- Existing secrets exposed in an earlier repository version should be rotated.
- Removing a backup from the current branch does not erase it from Git history; use an approved history-rewrite process before making a previously exposed repository public.
- Question review defaults to release only after an exam closes, reducing answer-key sharing during an active sitting.
