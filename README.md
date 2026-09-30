# DSA MCQ Assessment Web Application

A full-stack, college-grade **Data Structures & Algorithms MCQ Assessment Web Application** built with **React**, **TypeScript**, **Tailwind CSS**, **FastAPI**, **PostgreSQL**, and **SQLAlchemy**.

> [!IMPORTANT]
> **Fixed Question Bank**: This application uses the exact, fixed 50 DSA MCQ questions extracted directly from `Data_Structures_50_MCQ_Questions.docx`. No questions are added, modified, or omitted.

---

## 🚀 Key Features

### 🎓 Student Assessment Portal
1. **Student Registration Form**: Required fields: `Enrollment Number`, `Student Name`, `Department`.
2. **Fixed 50-Question Test**:
   - Single question display with exact 4 options (A, B, C, D) per question.
   - Interactive 1-50 grid navigation panel with color-coded status badges:
     - **Sky Blue**: Current question
     - **Emerald Green**: Answered question
     - **Slate Dark**: Unanswered question
   - **Previous** / **Next** navigation with state preservation.
   - Real-time incremental auto-saving to backend DB.
   - **Submit Test** confirmation modal preventing accidental submissions.
3. **Duplicate Attempt Protection**: Enforces exactly **one** completed attempt per Enrollment Number. If a student attempts to log in again, the application notifies: `"You have already completed this assessment."`
4. **Immediate Results & Performance Analysis**:
   - Displays Student Name, Enrollment Number, Department, Total Score (`Score / 50`), Correct Answers Count, Wrong Answers Count, and Percentage (`%`).
   - Detailed 50-Question review with:
     - **Green (`✓ CORRECT`)** badge for correct answers.
     - **Red (`✗ WRONG`)** badge for incorrect answers.
     - Highlights student's selected answer vs. authoritative correct answer.
     <img width="1891" height="943" alt="Screenshot 2026-09-30 051804" src="https://github.com/user-attachments/assets/b027e717-4649-43e5-ace1-0bd2b53ef961" />
     <img width="1894" height="929" alt="image" src="https://github.com/user-attachments/assets/8c555422-7d79-4011-9b27-59b17326f955" />

---

### 🛡️ Admin Management Panel
- **Secure Authentication**: JWT-based Admin Login (`/admin/login`).
- **Dashboard Analytics**: Real-time stats for:
  - Total Registered Students
  - Total Test Attempts
  - Total Completed Tests
  - Class Average Score
  - Class Average Percentage
- **Student Search & Audit**:
  - Filterable by Enrollment Number, Student Name, or Department.
  - One-click detailed inspection of any student's complete 50-question submission (`/admin/student/{id}`).
- **Excel/CSV Data Export**:
  - **Summary Export**: Excel workbook containing Enrollment No, Name, Department, Score, Percentage, Correct/Wrong counts, and Submission Date.
  - **Detailed Answer Export**: Excel workbook containing question-by-question student responses for all students.
<img width="1909" height="935" alt="Addd" src="https://github.com/user-attachments/assets/e6d2f448-8f17-4693-887a-f4fa68a27df5" />

---

## 📁 Project Directory Structure

```
dsa-mcq-platform/
├── backend/
│   ├── app/
│   │   ├── api.py               # All FastAPI endpoints (Auth, Students, Attempts, Admin)
│   │   ├── auth.py              # JWT Authentication middleware & password hashing
│   │   ├── config.py            # Pydantic environment configurations
│   │   ├── database.py          # SQLAlchemy PostgreSQL connection & engine (with SQLite fallback)
│   │   ├── main.py              # FastAPI application entry point with CORS setup
│   │   ├── models.py            # SQLAlchemy database tables (students, attempts, student_answers)
│   │   ├── questions_data.py    # Seed loader for fixed 50 DSA questions
│   │   └── schemas.py           # Pydantic validation schemas
│   ├── .env                     # Backend environment variables
│   └── requirements.txt         # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminDashboard.tsx      # Admin dashboard & student search table
│   │   │   ├── AdminLogin.tsx          # Protected admin login
│   │   │   ├── AdminStudentDetails.tsx  # Admin question-wise student audit log
│   │   │   ├── StudentRegistration.tsx # Student entry form
│   │   │   ├── StudentResult.tsx       # Student test result & question review
│   │   │   └── StudentTest.tsx         # 50-Question examination interface
│   │   ├── services/
│   │   │   └── api.ts                  # Axios API client with JWT bearer interceptor
│   │   ├── App.tsx                     # React Router routes
│   │   ├── index.css                   # Tailwind CSS styling
│   │   └── types.ts                    # TypeScript interface definitions
│   ├── tailwind.config.js              # Tailwind CSS configuration
│   └── package.json
├── dsa_questions.json           # Extracted 50 fixed questions JSON seed file
├── README.md
└── .env.example
```

---

## 🛠️ How to Run the Application

### 1. Database Prerequisites
Ensure PostgreSQL server is running on `localhost:5432` and create the database:
```sql
CREATE DATABASE dsa_mcq_db;
```
*(Note: If PostgreSQL is offline, the backend automatically falls back to local SQLite `dsa_assessment.db` to guarantee smooth execution).*

---

### 2. Running the Backend (FastAPI)

```bash
cd dsa-mcq-platform/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Backend API**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

---

### 3. Running the Frontend (React + Vite)

```bash
cd dsa-mcq-platform/frontend
npm install
npm run dev
```
- **Frontend App**: `http://localhost:5173`

---

## 🔑 Admin Credentials

| Parameter | Value |
| --- | --- |
| **Login Route** | `/admin/login` |
| **Username** | `` |
| **Password** | `` |
