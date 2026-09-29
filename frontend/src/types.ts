export interface Student {
  id: number;
  enrollment_no: string;
  name: string;
  department: string;
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
  is_correct: boolean;
}

export interface Attempt {
  id: number;
  student_id: number;
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
}

export interface TestResult {
  student: Student;
  attempt: Attempt;
  answers: StudentAnswer[];
}

export interface AdminStats {
  total_students: number;
  total_attempts: number;
  completed_tests: number;
  average_score: number;
  average_percentage: number;
}

export interface StudentSummary {
  student_id: number;
  enrollment_no: string;
  name: string;
  department: string;
  score: number | null;
  percentage: number | null;
  attempt_date: string | null;
  status: string;
  attempt_id: number | null;
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
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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
  started_at: string;
  deadline_at?: string;
  completed_at?: string;
  time_limit_minutes: number;
  total_questions: number;
  remaining_seconds: number;
  current_server_time: string;
  answers: { [qNum: number]: string | null };
}
