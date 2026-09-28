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
