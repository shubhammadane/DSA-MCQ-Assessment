import json
from datetime import datetime
from app.database import SessionLocal
from app import models
from app.auth import hash_password
from sqlalchemy import text

def restore_students():
    db = SessionLocal()
    try:
        with open('db_backup_pre_upgrade/backup_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)

        target_enrollments = ['BT25F05F001', 'MT24F05F006']
        dept_cse = db.query(models.Department).filter(models.Department.id == 15).first()

        for st_data in data.get('students', []):
            enr = st_data.get('enrollment_no')
            if enr in target_enrollments:
                existing = db.query(models.Student).filter(models.Student.enrollment_no == enr).first()
                if existing:
                    print(f"Student {enr} already exists with id {existing.id}. Skipping.")
                    continue

                created_dt = datetime.fromisoformat(st_data['created_at']) if 'created_at' in st_data else datetime.utcnow()
                new_st = models.Student(
                    id=st_data['id'],
                    enrollment_no=enr,
                    name=st_data['name'],
                    department=st_data.get('department') or (dept_cse.name if dept_cse else 'CSE'),
                    department_id=15,
                    password_hash=hash_password(enr),
                    is_active=True,
                    created_at=created_dt,
                    updated_at=created_dt
                )
                db.add(new_st)
                db.commit()
                db.refresh(new_st)
                print(f"Restored student {new_st.name} ({new_st.enrollment_no}) with ID={new_st.id}")

                # Restore attempt(s)
                s_attempts = [a for a in data.get('attempts', []) if a.get('student_id') == st_data['id']]
                for att_data in s_attempts:
                    ex_att = db.query(models.Attempt).filter(models.Attempt.id == att_data['id']).first()
                    if not ex_att:
                        start_dt = datetime.fromisoformat(att_data['started_at']) if att_data.get('started_at') else created_dt
                        comp_dt = datetime.fromisoformat(att_data['completed_at']) if att_data.get('completed_at') else None
                        sub_dt = datetime.fromisoformat(att_data['submitted_at']) if att_data.get('submitted_at') else comp_dt

                        new_att = models.Attempt(
                            id=att_data['id'],
                            student_id=new_st.id,
                            total_questions=att_data.get('total_questions', 50),
                            score=att_data.get('score', 0),
                            percentage=att_data.get('percentage', 0.0),
                            correct_answers=att_data.get('correct_answers', 0),
                            wrong_answers=att_data.get('wrong_answers', 0),
                            started_at=start_dt,
                            submitted_at=sub_dt,
                            completed_at=comp_dt or sub_dt,
                            status=att_data.get('status', 'completed'),
                            time_limit_minutes=att_data.get('time_limit_minutes', 60),
                            question_count_snapshot=att_data.get('question_count_snapshot', 50),
                            exam_title_snapshot='DSA 50-Question Assessment'
                        )
                        db.add(new_att)
                        db.commit()
                        db.refresh(new_att)
                        print(f"  Restored attempt {new_att.id} (Score={new_att.score}, Percentage={new_att.percentage}%)")

                        # Restore student answers
                        att_answers = [ans for ans in data.get('student_answers', []) if ans.get('attempt_id') == att_data['id']]
                        ans_objs = []
                        for ans_d in att_answers:
                            ans_dt = datetime.fromisoformat(ans_d['answered_at']) if ans_d.get('answered_at') else start_dt
                            is_corr = ans_d.get('is_correct', False)
                            ans_objs.append(models.StudentAnswer(
                                attempt_id=new_att.id,
                                question_number=ans_d.get('question_number'),
                                question_id=ans_d.get('question_id'),
                                question_text=ans_d.get('question_text'),
                                option_a=ans_d.get('option_a'),
                                option_b=ans_d.get('option_b'),
                                option_c=ans_d.get('option_c'),
                                option_d=ans_d.get('option_d'),
                                selected_answer=ans_d.get('selected_answer'),
                                correct_answer=ans_d.get('correct_answer'),
                                marks=1 if is_corr else 0,
                                is_correct=is_corr,
                                answered_at=ans_dt
                            ))
                        if ans_objs:
                            db.bulk_save_objects(ans_objs)
                            db.commit()
                            print(f"  Restored {len(ans_objs)} answers for attempt {new_att.id}")

        # Reset postgres sequences
        if db.bind.dialect.name == 'postgresql':
            for tbl in ['students', 'attempts', 'student_answers']:
                db.execute(text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), COALESCE(MAX(id), 1)) FROM {tbl};"))
            db.commit()

        print("\nRestoration completed successfully.")
    finally:
        db.close()

if __name__ == '__main__':
    restore_students()
