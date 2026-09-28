import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Send, HelpCircle, CheckCircle2, Clock } from 'lucide-react';
import api from '../services/api';
import type { Question } from '../types';

export const StudentTest: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionNumber: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [studentInfo, setStudentInfo] = useState<{ name: string; enrollment_no: string; department: string } | null>(null);

  useEffect(() => {
    const cachedStudent = sessionStorage.getItem('student');
    if (cachedStudent) {
      setStudentInfo(JSON.parse(cachedStudent));
    }

    const fetchQuestions = async () => {
      try {
        const response = await api.get('/questions');
        setQuestions(response.data);
      } catch (err) {
        console.error('Failed to load questions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const handleSelectOption = (optionKey: string) => {
    const qNum = currentIndex + 1;
    const updated = { ...answers, [qNum]: optionKey };
    setAnswers(updated);

    if (attemptId) {
      api.post(`/attempts/${attemptId}/answers`, {
        answers: [{ question_number: qNum, selected_answer: optionKey }]
      }).catch(err => console.error('Auto-save error:', err));
    }
  };

  const handleConfirmSubmit = async () => {
    if (!attemptId) return;
    setSubmitting(true);
    setShowConfirmModal(false);

    try {
      const payloadAnswers = Object.entries(answers).map(([qNum, sel]) => ({
        question_number: parseInt(qNum),
        selected_answer: sel
      }));

      await api.post(`/attempts/${attemptId}/answers`, { answers: payloadAnswers });
      await api.post(`/attempts/${attemptId}/submit`);

      navigate(`/result/${attemptId}`);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitting(false);
      alert('Failed to submit test. Please check connection and try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Loading Assessment Questions...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p>No questions available.</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentQNum = currentIndex + 1;
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">Data Structures MCQ Assessment</h1>
            <p className="text-xs text-slate-400">Total Questions: {totalQuestions} | Marks: 50</p>
          </div>
        </div>

        {studentInfo && (
          <div className="hidden md:flex items-center space-x-6 text-sm bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-xs">Student</span>
              <span className="font-semibold text-sky-400">{studentInfo.name}</span>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div>
              <span className="text-slate-500 block text-xs">Enrollment</span>
              <span className="font-semibold text-slate-300">{studentInfo.enrollment_no}</span>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div>
              <span className="text-slate-500 block text-xs">Department</span>
              <span className="font-semibold text-slate-300">{studentInfo.department}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowConfirmModal(true)}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center space-x-2 transition-all ml-auto"
        >
          <Send className="w-4 h-4" />
          <span>Submit Test</span>
        </button>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full">
              Question {currentQNum} of {totalQuestions}
            </span>
            <span className="text-xs text-slate-400 flex items-center space-x-1">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Status: {answers[currentQNum] ? 'Answered' : 'Unanswered'}</span>
            </span>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg md:text-xl font-semibold text-white leading-relaxed">
              {currentQuestion.question}
            </h2>

            <div className="space-y-3 pt-4">
              {Object.entries(currentQuestion.options).map(([key, value]) => {
                const isSelected = answers[currentQNum] === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectOption(key)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start space-x-4 ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500 text-white ring-1 ring-sky-500'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold flex-shrink-0 mt-0.5 ${
                        isSelected ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {key}
                    </span>
                    <span className="text-sm leading-relaxed">{value}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 text-sm font-medium flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs text-slate-500 font-medium">
              {answeredCount} of {totalQuestions} answered
            </span>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              disabled={currentIndex === totalQuestions - 1}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-sky-600/20"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col space-y-6 h-fit">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Question Navigation</h3>
          
          <div className="grid grid-cols-5 gap-2 max-h-96 overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const qNum = idx + 1;
              const isCurrent = currentIndex === idx;
              const isAnswered = !!answers[qNum];

              let stateClass = 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700';
              if (isCurrent) {
                stateClass = 'bg-sky-500 border-sky-400 text-white ring-2 ring-sky-400/50 font-bold';
              } else if (isAnswered) {
                stateClass = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 font-medium';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 rounded-lg border text-xs flex items-center justify-center transition-all ${stateClass}`}
                >
                  {qNum}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-sky-500 rounded-full inline-block"></span>
              <span>Current Question</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-emerald-500/40 border border-emerald-500 rounded-full inline-block"></span>
              <span>Answered Question</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-slate-950 border border-slate-800 rounded-full inline-block"></span>
              <span>Unanswered Question</span>
            </div>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Submit Test Confirmation</h3>
              <p className="text-sm text-slate-400">
                Are you sure you want to submit the test?
              </p>
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mt-2">
                You have answered <span className="font-bold">{answeredCount}</span> of <span className="font-bold">{totalQuestions}</span> questions.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
