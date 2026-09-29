import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, User, Building, CreditCard, RotateCcw, Check, X } from 'lucide-react';
import api from '../services/api';
import type { TestResult } from '../types';

export const StudentResult: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await api.get(`/attempts/${attemptId}/result`);
        setResult(response.data);
      } catch (err) {
        console.error('Failed to load test result:', err);
      } finally {
        setLoading(false);
      }
    };

    if (attemptId) {
      fetchResult();
    }
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Evaluating Performance & Calculating Results...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <p>Result not found.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  const { student, attempt, answers } = result;
  const isTimedOut = attempt.status === 'timed_out';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Trophy className="w-64 h-64 text-sky-400" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    isTimedOut
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {isTimedOut ? 'Assessment Timed Out (Auto-Submitted)' : 'Assessment Completed'}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">Test Score Summary</h1>
              </div>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium flex items-center space-x-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return to Portal</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
                <User className="w-5 h-5 text-sky-400" />
                <div>
                  <span className="text-xs text-slate-500 block">Student Name</span>
                  <span className="font-semibold text-white">{student.name}</span>
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
                <CreditCard className="w-5 h-5 text-sky-400" />
                <div>
                  <span className="text-xs text-slate-500 block">Enrollment Number</span>
                  <span className="font-semibold text-white">{student.enrollment_no}</span>
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center space-x-3">
                <Building className="w-5 h-5 text-sky-400" />
                <div>
                  <span className="text-xs text-slate-500 block">Department</span>
                  <span className="font-semibold text-white">{student.department}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl text-center space-y-1">
                <span className="text-xs text-slate-400 uppercase font-medium">Score</span>
                <p className="text-2xl md:text-3xl font-black text-sky-400">
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
                <span className="text-xs text-slate-400 uppercase font-medium">Wrong / Unanswered</span>
                <p className="text-2xl md:text-3xl font-black text-rose-500">{attempt.wrong_answers}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Question-Wise Review</h2>
            <span className="text-xs text-slate-400">Showing all {attempt.total_questions} questions</span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {Object.entries(ans.options).map(([optKey, optVal]) => {
                      const isSelected = ans.selected_answer === optKey;
                      const isAuthoritative = ans.correct_answer === optKey;

                      let optClass = 'bg-slate-950 border-slate-800 text-slate-400';
                      if (isAuthoritative) {
                        optClass = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 font-semibold ring-1 ring-emerald-500/30';
                      } else if (isSelected && !isAuthoritative) {
                        optClass = 'bg-rose-500/10 border-rose-500/50 text-rose-300 font-semibold ring-1 ring-rose-500/30';
                      }

                      return (
                        <div
                          key={optKey}
                          className={`p-3.5 rounded-xl border flex items-start space-x-3 text-sm ${optClass}`}
                        >
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                              isAuthoritative
                                ? 'bg-emerald-500 text-white'
                                : isSelected
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {optKey}
                          </span>
                          <span className="leading-snug">{optVal}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2 text-xs border-t border-slate-800/80">
                    <span className="text-slate-400">
                      Your Selected Answer:{' '}
                      <span className={`font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {ans.selected_answer ? `Option ${ans.selected_answer}` : 'Not Attempted'}
                      </span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">
                      Correct Key:{' '}
                      <span className="font-bold text-emerald-400">
                        Option {ans.correct_answer}
                      </span>
                    </span>
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
