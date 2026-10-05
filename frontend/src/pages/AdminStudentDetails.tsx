import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, User, CreditCard, Building, Check, X, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import type { TestResult } from '../types';

export const AdminStudentDetails: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    const fetchStudentDetails = async () => {
      try {
        const response = await api.get(`/admin/students/${studentId}`);
        setResult(response.data);
      } catch (err: any) {
        console.error('Failed to load student details:', err);
        if (err.response?.status === 401) {
          localStorage.removeItem('admin_token');
          navigate('/admin/login');
        }
      } finally {
        setLoading(false);
      }
    };

    if (studentId) {
      fetchStudentDetails();
    }
  }, [studentId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Loading Student Examination Audit Log...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <p>Student assessment record not found.</p>
        <button onClick={() => navigate('/admin/dashboard')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { student, attempt, answers, security_logs } = result;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Admin Dashboard</span>
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                Examination Assessment Audit
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">{student.name}</h1>
              <p className="text-xs text-slate-400 mt-1">
                Exam: <span className="text-white font-semibold">{attempt.exam_title_snapshot || 'General Assessment'}</span> • Subject: <span className="text-sky-400 font-semibold">{attempt.subject_name_snapshot || 'DSA'}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Submitted At</span>
              <span className="text-sm font-semibold text-slate-200">
                {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : (attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : 'N/A')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center space-x-3">
              <User className="w-5 h-5 text-indigo-400" />
              <div>
                <span className="text-xs text-slate-500 block">Student Name</span>
                <span className="font-semibold text-white">{student.name}</span>
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center space-x-3">
              <CreditCard className="w-5 h-5 text-indigo-400" />
              <div>
                <span className="text-xs text-slate-500 block">Enrollment Number</span>
                <span className="font-semibold text-white font-mono">{student.enrollment_no}</span>
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center space-x-3">
              <Building className="w-5 h-5 text-indigo-400" />
              <div>
                <span className="text-xs text-slate-500 block">Department</span>
                <span className="font-semibold text-white">{student.department}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs text-slate-400 uppercase font-medium">Score</span>
              <p className="text-2xl md:text-3xl font-black text-indigo-400">
                {attempt.score} <span className="text-sm font-normal text-slate-500">/ {attempt.total_questions}</span>
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs text-slate-400 uppercase font-medium">Percentage</span>
              <p className="text-2xl md:text-3xl font-black text-emerald-400">{attempt.percentage}%</p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs text-slate-400 uppercase font-medium">Correct</span>
              <p className="text-2xl md:text-3xl font-black text-emerald-500">{attempt.correct_answers}</p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs text-slate-400 uppercase font-medium">Wrong</span>
              <p className="text-2xl md:text-3xl font-black text-rose-500">{attempt.wrong_answers}</p>
            </div>
          </div>

          {/* Anti-cheating monitoring summary */}
          {(attempt.tab_switch_count > 0 || attempt.fullscreen_exit_count > 0 || attempt.copy_count > 0 || attempt.paste_count > 0 || (security_logs && security_logs.length > 0)) && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5" />
                <span>Anti-Cheating Audit Alerts & Event Logs</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-400 block text-[11px]">Tab Switches</span>
                  <span className="font-bold text-rose-400 text-base">{attempt.tab_switch_count || 0}</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-400 block text-[11px]">Fullscreen Exits</span>
                  <span className="font-bold text-rose-400 text-base">{attempt.fullscreen_exit_count || 0}</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-400 block text-[11px]">Copy Attempts</span>
                  <span className="font-bold text-amber-400 text-base">{attempt.copy_count || 0}</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-400 block text-[11px]">Paste Attempts</span>
                  <span className="font-bold text-amber-400 text-base">{attempt.paste_count || 0}</span>
                </div>
              </div>

              {security_logs && security_logs.length > 0 && (
                <div className="space-y-1.5 pt-2 max-h-40 overflow-y-auto">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Detailed Security Timeline</span>
                  {security_logs.map((log) => (
                    <div key={log.id} className="text-[11px] text-slate-300 flex justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span>• [{log.event_type}] {log.details || 'Security event recorded'}</span>
                      <span className="font-mono text-slate-500">{new Date(log.occurred_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Answers List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Full Answer Audit ({answers.length} Questions)</h2>
            <span className="text-xs text-slate-400">Read-only student attempt snapshot</span>
          </div>

          <div className="space-y-4">
            {answers.map((ans) => {
              const isCorrect = ans.is_correct;
              return (
                <div
                  key={ans.question_number}
                  className={`bg-slate-900 border rounded-2xl p-6 transition-all space-y-4 ${
                    isCorrect ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-rose-500/30 bg-rose-950/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
                    <span className="text-sm font-bold text-slate-300">
                      Q{ans.question_number}
                    </span>
                    <div className="flex items-center space-x-2">
                      {isCorrect ? (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-4 h-4" />
                          <span>CORRECT</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <X className="w-4 h-4" />
                          <span>WRONG</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-base font-medium text-white leading-relaxed">
                    {ans.question}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div
                      className={`p-3 rounded-xl border text-sm flex items-center justify-between ${
                        isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <span className="text-xs uppercase font-semibold text-slate-400">Student Answer:</span>
                      <span className="font-bold">{ans.selected_answer || 'Not Answered'}</span>
                    </div>

                    <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm flex items-center justify-between">
                      <span className="text-xs uppercase font-semibold text-slate-400">Correct Answer:</span>
                      <span className="font-bold">{ans.correct_answer}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
export default AdminStudentDetails;
