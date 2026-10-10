import json
from app.database import SessionLocal
from app import models

def audit_records():
    db = SessionLocal()
    try:
        all_students = db.query(models.Student).order_by(models.Student.id.asc()).all()
        report = []

        for s in all_students:
            attempts = db.query(models.Attempt).filter(models.Attempt.student_id == s.id).all()
            att_info = []
            total_answers = 0
            for a in attempts:
                ans_count = db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == a.id).count()
                total_answers += ans_count
                att_info.append({
                    'attempt_id': a.id,
                    'status': a.status,
                    'score': a.score,
                    'total_questions': a.total_questions,
                    'percentage': a.percentage,
                    'started_at': a.started_at.isoformat() if a.started_at else None,
                    'completed_at': a.completed_at.isoformat() if a.completed_at else None,
                    'answers_count': ans_count
                })
            sec_logs_count = db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.student_id == s.id).count()
            exam_assignments = db.query(models.ExamStudent).filter(models.ExamStudent.student_id == s.id).count()

            # Determine origin
            origin = 'Unknown'
            if s.enrollment_no == 'BT24F05F007':
                origin = 'Legitimate (Shubham Madane - Core User)'
            elif s.enrollment_no in ['BT25F05F001', 'MT24F05F006']:
                origin = 'Legitimate (Restored from pre-upgrade backup)'
            elif s.enrollment_no == 'MT24f05f004':
                origin = 'Legitimate (Arya - Enrolled Student)'
            elif s.enrollment_no == 'DEL_ATTEMPT_STU_001':
                origin = 'Test Artifact: test_delete_attempt_requirements.py (Student A)'
            elif s.enrollment_no == 'DEL_ATTEMPT_STU_002':
                origin = 'Test Artifact: test_delete_attempt_requirements.py (Student B)'
            elif 'BT26F' in s.enrollment_no or 'TEST' in s.enrollment_no:
                origin = 'Test Artifact: test_comprehensive_system.py'
            elif 'CSE' in s.enrollment_no:
                origin = 'Test Artifact: verify_live_workflows.py'

            item = {
                'id': s.id,
                'name': s.name,
                'enrollment_no': s.enrollment_no,
                'department': s.department,
                'department_id': s.department_id,
                'created_at': s.created_at.isoformat() if s.created_at else None,
                'attempts_count': len(attempts),
                'attempts': att_info,
                'total_answers': total_answers,
                'security_logs_count': sec_logs_count,
                'exam_assignments_count': exam_assignments,
                'origin': origin,
                'is_legitimate': origin.startswith('Legitimate')
            }
            report.append(item)
            status_tag = '[LEGITIMATE]' if item['is_legitimate'] else '[TEST CANDIDATE]'
            print(f"{status_tag} ID {s.id}: {s.name} ({s.enrollment_no}) | {origin} | Attempts: {len(attempts)} | Answers: {total_answers}")

        with open('student_cleanup_investigation_report.json', 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        print("\nReport written to student_cleanup_investigation_report.json")
    finally:
        db.close()

if __name__ == '__main__':
    audit_records()
