"""Seed academic departments, programs, years, and semesters idempotently.

Ensures:
1. Department seeding is idempotent and does not create duplicates.
2. Program, Academic Year, and Semester seeding is idempotent.
3. Preserves all existing students, subjects, exams, questions, and attempt records.
"""
from datetime import datetime
from sqlalchemy import func
from app.database import SessionLocal
from app import models


def seed_academic_structure():
    db = SessionLocal()
    try:
        # Snapshot initial counts to guarantee preservation
        initial_counts = {
            "students": db.query(models.Student).count(),
            "subjects": db.query(models.Subject).count(),
            "questions": db.query(models.Question).count(),
            "exams": db.query(models.Exam).count(),
            "attempts": db.query(models.Attempt).count(),
            "answers": db.query(models.StudentAnswer).count(),
        }

        print("=== Checking Initial Database State ===")
        for k, v in initial_counts.items():
            print(f"  Existing {k}: {v}")

        # ----------------------------------------------------
        # 1. Departments Seeding (Idempotent)
        # ----------------------------------------------------
        departments_data = [
            {"name": "Computer Science & Engineering", "code": "CSE"},
            {"name": "Information Technology", "code": "IT"},
            {"name": "Civil Engineering Department", "code": "CIVIL"},
            {"name": "Electrical Engineering Department", "code": "EE"},
            {"name": "Mechanical Engineering Department", "code": "MECH"},
            {"name": "Electronics & Telecommunication", "code": "ENTC"},
            {"name": "Master in Computer Application", "code": "MCA"},
            {"name": "Applied Mechanics Department", "code": "AM"},
            {"name": "Applied Mathematics", "code": "MATH"},
            {"name": "Science", "code": "SCI"},
        ]

        print("\n=== Seeding Departments ===")
        for dd in departments_data:
            existing = db.query(models.Department).filter(
                func.lower(models.Department.name) == dd["name"].lower()
            ).first()

            if not existing:
                dept = models.Department(
                    name=dd["name"],
                    code=dd["code"],
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                db.add(dept)
                db.commit()
                db.refresh(dept)
                print(f"  [ADDED] Department: {dept.name} ({dept.code}) (id={dept.id})")
            else:
                existing.is_active = True
                if not existing.code and dd["code"]:
                    existing.code = dd["code"]
                db.commit()
                print(f"  [EXISTS] Department: {existing.name} ({existing.code}) (id={existing.id})")

        # ----------------------------------------------------
        # 2. Programs Seeding (Idempotent)
        # ----------------------------------------------------
        programs_data = [
            {"name": "UG", "code": "UG"},
            {"name": "M.Tech", "code": "PG"},
        ]

        print("\n=== Seeding Programs ===")
        prog_ids = {}
        for pd in programs_data:
            existing = db.query(models.Program).filter(
                func.lower(models.Program.name) == pd["name"].lower()
            ).first()

            if not existing:
                prog = models.Program(
                    name=pd["name"],
                    code=pd["code"],
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                db.add(prog)
                db.commit()
                db.refresh(prog)
                prog_ids[pd["name"]] = prog.id
                print(f"  [ADDED] Program: {prog.name} (id={prog.id})")
            else:
                prog_ids[pd["name"]] = existing.id
                print(f"  [EXISTS] Program: {existing.name} (id={existing.id})")

        ug_id = prog_ids["UG"]
        mt_id = prog_ids["M.Tech"]

        # ----------------------------------------------------
        # 3. Academic Years Seeding (Idempotent)
        # ----------------------------------------------------
        ug_years = [("1st Year", 1), ("2nd Year", 2), ("3rd Year", 3), ("Final Year", 4)]
        mt_years = [("M.Tech 1st Year", 1), ("M.Tech 2nd Year", 2)]

        print("\n=== Seeding Academic Years ===")
        year_map = {}
        for prog_id, pairs in [(ug_id, ug_years), (mt_id, mt_years)]:
            for yname, ynum in pairs:
                ex = db.query(models.AcademicYear).filter(
                    models.AcademicYear.program_id == prog_id,
                    models.AcademicYear.year_number == ynum
                ).first()

                if not ex:
                    ay = models.AcademicYear(
                        program_id=prog_id,
                        name=yname,
                        year_number=ynum,
                        is_active=True
                    )
                    db.add(ay)
                    db.commit()
                    db.refresh(ay)
                    year_map[(prog_id, ynum)] = ay.id
                    print(f"  [ADDED] Year: {yname} (id={ay.id})")
                else:
                    year_map[(prog_id, ynum)] = ex.id
                    print(f"  [EXISTS] Year: {yname} (id={ex.id})")

        # ----------------------------------------------------
        # 4. Semesters Seeding (Idempotent)
        # ----------------------------------------------------
        ug_sems = [
            (1, "Semester 1", 1), (1, "Semester 2", 2),
            (2, "Semester 3", 3), (2, "Semester 4", 4),
            (3, "Semester 5", 5), (3, "Semester 6", 6),
            (4, "Semester 7", 7), (4, "Semester 8", 8)
        ]
        mt_sems = [
            (1, "Semester 1", 1), (1, "Semester 2", 2),
            (2, "Semester 3", 3), (2, "Semester 4", 4)
        ]

        print("\n=== Seeding Semesters ===")
        for prog_id, sems in [(ug_id, ug_sems), (mt_id, mt_sems)]:
            for ynum, sname, snum in sems:
                ay_id = year_map.get((prog_id, ynum))
                if not ay_id:
                    continue
                ex = db.query(models.Semester).filter(
                    models.Semester.program_id == prog_id,
                    models.Semester.academic_year_id == ay_id,
                    models.Semester.semester_number == snum
                ).first()

                if not ex:
                    sem = models.Semester(
                        program_id=prog_id,
                        academic_year_id=ay_id,
                        name=sname,
                        semester_number=snum,
                        is_active=True
                    )
                    db.add(sem)
                    print(f"  [ADDED] Semester: {sname} (year={ynum})")
                else:
                    print(f"  [EXISTS] Semester: {sname} (id={ex.id})")

        db.commit()

        # ----------------------------------------------------
        # 5. Safe backfill for legacy students missing department_id
        # ----------------------------------------------------
        active_depts = db.query(models.Department).all()
        dept_lookup = {d.name.lower(): d.id for d in active_depts}
        # Also map short forms if common
        dept_lookup["computer science"] = dept_lookup.get("computer science & engineering")

        legacy_students = db.query(models.Student).filter(models.Student.department_id == None).all()
        linked_count = 0
        for st in legacy_students:
            if st.department and st.department.lower() in dept_lookup:
                matched_id = dept_lookup[st.department.lower()]
                if matched_id:
                    st.department_id = matched_id
                    linked_count += 1
        if linked_count > 0:
            db.commit()
            print(f"\nSafely linked {linked_count} legacy student(s) to their respective department_id.")

        # ----------------------------------------------------
        # 6. Verification of Data Preservation
        # ----------------------------------------------------
        final_counts = {
            "students": db.query(models.Student).count(),
            "subjects": db.query(models.Subject).count(),
            "questions": db.query(models.Question).count(),
            "exams": db.query(models.Exam).count(),
            "attempts": db.query(models.Attempt).count(),
            "answers": db.query(models.StudentAnswer).count(),
        }

        print("\n=== Final Integrity Check ===")
        for k, v in final_counts.items():
            diff = v - initial_counts[k]
            status_str = "PRESERVED" if diff == 0 else f"CHANGED (+{diff})"
            print(f"  {k.capitalize()}: {v} ({status_str})")

        assert final_counts["students"] == initial_counts["students"], "Student count mismatch!"
        assert final_counts["subjects"] == initial_counts["subjects"], "Subject count mismatch!"
        assert final_counts["questions"] == initial_counts["questions"], "Question count mismatch!"
        assert final_counts["exams"] == initial_counts["exams"], "Exam count mismatch!"
        assert final_counts["attempts"] == initial_counts["attempts"], "Attempt count mismatch!"
        assert final_counts["answers"] == initial_counts["answers"], "StudentAnswer count mismatch!"

        print("\nDatabase structure and counts successfully verified! All existing records preserved.")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_academic_structure()
