export interface Department {
  id: number;
  name: string;
  code?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Program {
  id: number;
  name: string;
  code?: string;
  is_active: boolean;
}

export interface AcademicYear {
  id: number;
  program_id: number;
  name: string;
  year_number: number;
  is_active: boolean;
}

export interface Semester {
  id: number;
  program_id: number;
  academic_year_id: number;
  name: string;
  semester_number: number;
  is_active: boolean;
}

export interface AcademicStructure {
  departments: Department[];
  programs: Program[];
  years: AcademicYear[];
  semesters: Semester[];
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  department_id: number;
  department_name?: string;
  program_id?: number;
  program_name?: string;
  academic_year_id?: number;
  year_name?: string;
  semester_id?: number;
  semester_name?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: number;
  enrollment_no: string;
  name: string;
  department: string;
  gender?: string | null;
  program?: string | null;
  year?: string | null;
  semester?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Question {
  id: number;
  question: string;
  options: {
    [key: string]: string;
  };
}

export interface StudentAnswer {
  question_number: number;
  question: string;
  options: { [key: string]: string };
  selected_answer: string | null;
  correct_answer: string;
  marks?: number;
  is_correct: boolean;
}

export interface SecurityLog {
  id: number;
  attempt_id: number;
  student_id: number;
  event_type: string;
  details?: string | null;
  occurred_at: string;
}

export interface Attempt {
  id: number;
  student_id: number;
  exam_id?: number | null;
  exam_title_snapshot?: string | null;
  subject_name_snapshot?: string | null;
  total_questions: number;
  score: number;
  percentage: number;
  correct_answers: number;
  wrong_answers: number;
  started_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  deadline_at: string | null;
  time_limit_minutes: number;
  question_count_snapshot: number;
  status: string;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  copy_count: number;
  paste_count: number;
}

export interface TestResult {
  student: Student;
  attempt: Attempt;
  answers: StudentAnswer[];
  security_logs?: SecurityLog[];
}

export interface AdminStats {
  total_students: number;
  total_attempts: number;
  completed_tests: number;
  average_score: number;
  average_percentage: number;
  total_departments?: number;
  total_subjects?: number;
  active_subjects?: number;
  total_exams?: number;
  active_exams?: number;
  total_questions?: number;
}

export interface StudentSummary {
  student_id: number;
  enrollment_no: string;
  name: string;
  department: string;
  gender?: string | null;
  program?: string | null;
  year?: string | null;
  semester?: string | null;
  is_active?: boolean;
  score: number | null;
  percentage: number | null;
  attempt_date: string | null;
  status: string;
  attempt_id: number | null;
  exam_title?: string | null;
  tab_switch_count?: number;
  fullscreen_exit_count?: number;
}

export interface AdminQuestion {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  topic?: string;
  department_id?: number | null;
  department_name?: string | null;
  program_id?: number | null;
  program_name?: string | null;
  academic_year_id?: number | null;
  year_name?: string | null;
  semester_id?: number | null;
  semester_name?: string | null;
  subject_id?: number | null;
  subject_name?: string | null;
  difficulty?: string;
  marks?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Exam {
  id: number;
  title: string;
  code?: string;
  department_id?: number | null;
  department_name?: string | null;
  program_id?: number | null;
  program_name?: string | null;
  academic_year_id?: number | null;
  year_name?: string | null;
  semester_id?: number | null;
  semester_name?: string | null;
  subject_id?: number | null;
  subject_name?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  duration_minutes: number;
  total_questions: number;
  marks_per_question: number;
  total_marks: number;
  passing_percentage: number;
  selection_mode: string;
  status: string;
  is_active: boolean;
  assigned_students_count: number;
  attempts_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface StudentAvailableExam {
  id: number;
  title: string;
  code?: string | null;
  subject_name?: string | null;
  department_name?: string | null;
  duration_minutes: number;
  total_questions: number;
  total_marks: number;
  passing_percentage: number;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  status: string; // 'available', 'in_progress', 'completed', 'timed_out', 'closed', 'upcoming'
  attempt_id?: number | null;
  score?: number | null;
  percentage?: number | null;
}

export interface AssignedStudent {
  student_id: number;
  enrollment_no: string;
  name: string;
  department: string;
  gender?: string | null;
  program?: string | null;
  year?: string | null;
  semester?: string | null;
  assigned_at?: string;
  attempt_id?: number | null;
  status?: string | null;
  score?: number | null;
  percentage?: number | null;
}

export interface AssessmentSettings {
  question_count: number;
  time_limit_minutes: number;
  active_questions_count: number;
  total_questions_count: number;
  updated_at?: string;
}

export interface AttemptStatus {
  attempt_id: number;
  status: string;
  exam_id?: number | null;
  exam_title?: string | null;
  subject_name?: string | null;
  started_at: string;
  deadline_at?: string;
  completed_at?: string;
  time_limit_minutes: number;
  total_questions: number;
  remaining_seconds: number;
  current_server_time: string;
  tab_switch_count?: number;
  fullscreen_exit_count?: number;
  answers: { [qNum: number]: string | null };
}

export interface DepartmentStats {
  id: number;
  name: string;
  code?: string;
  is_active: boolean;
  students_count: number;
  active_subjects_count: number;
  exams_count: number;
  active_exams_count: number;
}

export interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email?: string | null;
  role: 'super_admin' | 'hod' | 'faculty';
  department_id?: number | null;
  department_name?: string | null;
  is_active: boolean;
  created_at?: string;
}
