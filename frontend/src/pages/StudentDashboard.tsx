import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CreditCard,
  Building,
  GraduationCap,
  Clock,
  Play,
  AlertCircle,
  LogOut,
  Trophy,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';
import type { Student, StudentAvailableExam } from '../types';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [exams, setExams] = useState<StudentAvailableExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingExamId, setStartingExamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const studentToken = sessionStorage.getItem('student_token') || localStorage.getItem('student_token');
      if (!studentToken) {
        navigate('/');
        return;
      }

      // Fetch profile
      const profRes = await api.get<Student>('/student/profile');
      setStudent(profRes.data);
      sessionStorage.setItem('student', JSON.stringify(profRes.data));

      // Fetch assigned exams
      const examRes = await api.get<StudentAvailableExam[]>('/student/exams');
      setExams(examRes.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        sessionStorage.removeItem('student_token');
        localStorage.removeItem('student_token');
        navigate('/');
      } else {
        setError(err.response?.data?.detail || 'Failed to load assigned examinations.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleStartExam = async (examId: number) => {
    setStartingExamId(examId);
    setError(null);
    try {
      const res = await api.post(`/student/exams/${examId}/start`);
      const { attempt_id } = res.data;
      sessionStorage.setItem('attempt_id', attempt_id.toString());
      navigate(`/test/${attempt_id}`);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to start exam.';
      setError(detail);
      setStartingExamId(null);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('student_token');
    localStorage.removeItem('student_token');
    sessionStorage.removeItem('student');
    sessionStorage.removeItem('attempt_id');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Loading Student Examination Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">College Examination Portal</h1>
              <p className="text-xs text-slate-400">Student Examination & Assessment Desk</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={fetchDashboardData}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Student Profile Card */}
        {student && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full text-xs font-semibold text-sky-400">
                  <span>Enrolled Student</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white">{student.name}</h2>
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    <CreditCard className="w-4 h-4 text-sky-400" />
                    <span className="text-slate-200 font-mono font-medium">{student.enrollment_no}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1.5">
                    <Building className="w-4 h-4 text-sky-400" />
                    <span>{student.department}</span>
                  </span>
                </div>
              </div>

              {/* Academic Tags */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-2.5 text-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Program</span>
                  <span className="text-sm font-bold text-white">{student.program || 'UG'}</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-2.5 text-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Academic Year</span>
                  <span className="text-sm font-bold text-white">{student.year || '1st Year'}</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-2.5 text-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Semester</span>
                  <span className="text-sm font-bold text-white">{student.semester || 'Semester 1'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-3 text-rose-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Access Restricted</span>
              <p className="text-sm text-rose-300/90">{error}</p>
            </div>
          </div>
        )}

        {/* Available Assigned Exams Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                <span>Assigned Examinations</span>
              </h3>
              <p className="text-xs text-slate-400">
                Only exams specifically authorized and assigned to your enrollment account appear below.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 font-medium">
              {exams.length} Assigned Exam{exams.length === 1 ? '' : 's'}
            </span>
          </div>

          {exams.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-white">No Examinations Assigned Yet</h4>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Your department has not assigned any active examinations to your account at this time. Please check back later or consult your exam coordinator.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {exams.map((exam) => {
                const isCompleted = exam.status === 'completed' || exam.status === 'timed_out';
                const isInProgress = exam.status === 'in_progress';

                return (
                  <div
                    key={exam.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition-all rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-lg relative group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isInProgress
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}>
                          {exam.status.replace('_', ' ')}
                        </span>
                        {exam.code && (
                          <span className="text-xs font-mono text-slate-500 font-semibold">{exam.code}</span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                          {exam.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Subject: <span className="text-slate-200 font-medium">{exam.subject_name || 'General'}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{exam.duration_minutes} Mins</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                          <span>{exam.total_questions} Questions</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Trophy className="w-3.5 h-3.5 text-slate-500" />
                          <span>{exam.total_marks} Total Marks</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">{exam.department_name || 'All Depts'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="pt-2">
                      {isCompleted ? (
                        <div className="space-y-3">
                          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Final Score</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-emerald-400">
                                {exam.score} / {exam.total_questions}
                              </span>
                              <span className="text-[11px] text-slate-500 block">({exam.percentage}%)</span>
                            </div>
                          </div>
                          {exam.attempt_id && (
                            <button
                              onClick={() => navigate(`/result/${exam.attempt_id}`)}
                              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                            >
                              <span>View Scorecard</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          disabled={startingExamId === exam.id}
                          className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 text-sm"
                        >
                          {startingExamId === exam.id ? (
                            <span>Preparing Exam...</span>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>{isInProgress ? 'RESUME EXAM' : 'START EXAM'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Existing General DSA MCQ Practice Card for Backward Compatibility */}
        <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-semibold uppercase">Legacy Assessment</span>
              <span>DSA 50-Question Practice Test</span>
            </h4>
            <p className="text-xs text-slate-400">
              Take the standard Data Structures & Algorithms 50-question general assessment test.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Launch Practice Test
          </button>
        </section>
      </main>
    </div>
  );
};
export default StudentDashboard;
