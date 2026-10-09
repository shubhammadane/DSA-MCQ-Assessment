import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CreditCard,
  Building,
  Clock,
  Play,
  AlertCircle,
  LogOut,
  Trophy,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { CollegeBranding } from '../components/CollegeBranding';
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
      <div className="min-h-screen bg-[#F5F8FC] flex flex-col items-center justify-center text-slate-800 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 font-medium">Loading Student Examination Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col">
      {/* Top Navbar — Official College Branding */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* College Branding */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <CollegeBranding size="sm" />
            <div className="hidden sm:block w-px h-10 bg-slate-200 flex-shrink-0" />
            <div className="hidden sm:block flex-shrink-0">
              <h1 className="text-sm font-bold text-slate-900">Online Examination Portal</h1>
              <p className="text-[11px] text-slate-500">Student Examination &amp; Assessment Desk</p>
            </div>
          </div>
          {/* Controls */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <button
              onClick={fetchDashboardData}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
                  <span>Enrolled Student</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">{student.name}</h2>
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-slate-600">
                  <span className="flex items-center space-x-1.5">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-900 font-mono font-semibold">{student.enrollment_no}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1.5">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-slate-800">{student.department}</span>
                  </span>
                </div>
              </div>

              {/* Academic Tags */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Program</span>
                  <span className="text-sm font-bold text-slate-900">{student.program || 'UG'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Academic Year</span>
                  <span className="text-sm font-bold text-slate-900">{student.year || '1st Year'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Semester</span>
                  <span className="text-sm font-bold text-slate-900">{student.semester || 'Semester 1'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-rose-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
            <div className="space-y-1">
              <span className="font-semibold block">Access Restricted</span>
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          </div>
        )}

        {/* Available Assigned Exams Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>Assigned Examinations</span>
              </h3>
              <p className="text-xs text-slate-500">
                Only exams specifically authorized and assigned to your enrollment account appear below.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold shadow-xs">
              {exams.length} Assigned Exam{exams.length === 1 ? '' : 's'}
            </span>
          </div>

          {exams.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-slate-900">No Examinations Assigned Yet</h4>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
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
                    className="bg-white border border-slate-200 hover:border-blue-300 transition-all rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-xs relative group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isInProgress
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {exam.status.replace('_', ' ')}
                        </span>
                        {exam.code && (
                          <span className="text-xs font-mono text-slate-500 font-semibold">{exam.code}</span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {exam.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Subject: <span className="text-slate-800 font-medium">{exam.subject_name || 'General'}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exam.duration_minutes} Mins</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exam.total_questions} Questions</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Trophy className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exam.total_marks} Total Marks</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{exam.department_name || 'All Depts'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="pt-2">
                      {isCompleted ? (
                        <div className="space-y-3">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-xs text-slate-600 font-medium">Final Score</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-emerald-600">
                                {exam.score} / {exam.total_questions}
                              </span>
                              <span className="text-[11px] text-slate-500 block">({exam.percentage}%)</span>
                            </div>
                          </div>
                          {exam.attempt_id && (
                            <button
                              onClick={() => navigate(`/result/${exam.attempt_id}`)}
                              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border border-slate-200"
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
                          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-50 text-sm cursor-pointer"
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
        <section className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-semibold uppercase">Legacy Assessment</span>
              <span>DSA 50-Question Practice Test</span>
            </h4>
            <p className="text-xs text-slate-500">
              Take the standard Data Structures &amp; Algorithms 50-question general assessment test.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
          >
            Launch Practice Test
          </button>
        </section>
      </main>
    </div>
  );
};
export default StudentDashboard;
