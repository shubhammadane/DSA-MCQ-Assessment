import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  Clock,
  Maximize2,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { CollegeBranding } from '../components/CollegeBranding';
import type { Question, AttemptStatus } from '../types';

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

  // Exam / Attempt details
  const [examTitle, setExamTitle] = useState<string>('Online Assessment');
  const [subjectName, setSubjectName] = useState<string>('General');

  // Anti-cheating & security states
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [tabSwitchWarnings, setTabSwitchWarnings] = useState<number>(0);
  const [securityWarningMessage, setSecurityWarningMessage] = useState<string | null>(null);

  // Timer states
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAutoSubmittingRef = useRef<boolean>(false);

  // Record security event to backend
  const logSecurityEvent = useCallback(async (eventType: string, details?: string) => {
    if (!attemptId) return;
    try {
      await api.post(`/attempts/${attemptId}/security-log`, {
        event_type: eventType,
        details: details || null,
      }).catch(() => {});
    } catch {
      // Non-blocking
    }
  }, [attemptId]);

  const handleAutoSubmit = useCallback(async () => {
    if (isAutoSubmittingRef.current || !attemptId) return;
    isAutoSubmittingRef.current = true;
    setIsTimedOut(true);
    setSubmitting(true);

    try {
      const payloadAnswers = Object.entries(answers).map(([qNum, sel]) => ({
        question_number: parseInt(qNum, 10),
        selected_answer: sel,
      }));
      if (payloadAnswers.length > 0) {
        await api.post(`/attempts/${attemptId}/answers`, { answers: payloadAnswers }).catch(() => {});
      }
      await api.post(`/attempts/${attemptId}/submit`).catch(() => {});
      navigate(`/result/${attemptId}`);
    } catch (err) {
      console.error('Auto-submission error:', err);
      navigate(`/result/${attemptId}`);
    }
  }, [attemptId, answers, navigate]);

  // Request fullscreen
  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    }
  };

  // Anti-Cheating Event Handlers
  useEffect(() => {
    // 1. Detect tab switch / window blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchWarnings((prev) => prev + 1);
        setSecurityWarningMessage('Tab switch detected! Your action has been recorded in the exam security audit log.');
        logSecurityEvent('tab_switch', 'Student navigated away from exam tab/window.');
      }
    };

    const handleWindowBlur = () => {
      if (!isTimedOut) {
        logSecurityEvent('tab_switch', 'Window lost focus.');
      }
    };

    // 2. Fullscreen change detection
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && !isTimedOut) {
        setSecurityWarningMessage('Fullscreen exited! Please return to fullscreen mode to continue examination.');
        logSecurityEvent('fullscreen_exit', 'Student exited fullscreen mode.');
      }
    };

    // 3. Prevent Copy & Paste
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      setSecurityWarningMessage('Copying question content is disabled during examinations.');
      logSecurityEvent('copy_attempt', 'Attempted to copy exam content.');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setSecurityWarningMessage('Pasting content is disabled during examinations.');
      logSecurityEvent('paste_attempt', 'Attempted to paste content.');
    };

    // 4. Prevent Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 5. Restrict common keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'v', 'u', 'p', 's', 'a'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        setSecurityWarningMessage('Restricted shortcut blocked for exam security.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [logSecurityEvent, isTimedOut]);

  // Initial Data Fetch
  useEffect(() => {
    const cachedStudent = sessionStorage.getItem('student');
    if (cachedStudent) {
      setStudentInfo(JSON.parse(cachedStudent));
    }

    if (!attemptId) {
      navigate('/');
      return;
    }

    const initTest = async () => {
      try {
        const statusRes = await api.get<AttemptStatus>(`/attempts/${attemptId}/status`);
        const statusData = statusRes.data;

        if (statusData.status === 'completed' || statusData.status === 'timed_out') {
          navigate(`/result/${attemptId}`);
          return;
        }

        if (statusData.exam_title) setExamTitle(statusData.exam_title);
        if (statusData.subject_name) setSubjectName(statusData.subject_name);

        setRemainingSeconds(statusData.remaining_seconds);

        if (statusData.answers) {
          const preloaded: { [qNum: number]: string } = {};
          Object.entries(statusData.answers).forEach(([k, v]) => {
            if (v) preloaded[parseInt(k, 10)] = v;
          });
          setAnswers(preloaded);
        }

        const qRes = await api.get<Question[]>(`/questions?attempt_id=${attemptId}`);
        setQuestions(qRes.data);
      } catch (err: any) {
        console.error('Failed to initialize test:', err);
        if (err.response?.status === 404) {
          navigate('/');
        }
      } finally {
        setLoading(false);
      }
    };

    initTest();
  }, [attemptId, navigate]);

  // Timer Countdown Effect
  useEffect(() => {
    if (remainingSeconds === null || isTimedOut) return;

    if (remainingSeconds <= 0) {
      handleAutoSubmit();
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingSeconds, isTimedOut, handleAutoSubmit]);

  const handleSelectAnswer = async (selectedKey: string) => {
    if (!questions[currentIndex] || isTimedOut) return;
    const currentQ = questions[currentIndex];

    const updatedAnswers = {
      ...answers,
      [currentQ.id]: selectedKey,
    };
    setAnswers(updatedAnswers);

    try {
      await api.post(`/attempts/${attemptId}/answers`, {
        question_number: currentQ.id,
        selected_answer: selectedKey,
      });
    } catch (err) {
      console.error('Failed to save answer:', err);
    }
  };

  const handleManualSubmit = async () => {
    if (submitting || !attemptId) return;
    setSubmitting(true);
    setShowConfirmModal(false);

    try {
      const payloadAnswers = Object.entries(answers).map(([qNum, sel]) => ({
        question_number: parseInt(qNum, 10),
        selected_answer: sel,
      }));
      if (payloadAnswers.length > 0) {
        await api.post(`/attempts/${attemptId}/answers`, { answers: payloadAnswers }).catch(() => {});
      }
      await api.post(`/attempts/${attemptId}/submit`);
      navigate(`/result/${attemptId}`);
    } catch (err: any) {
      console.error('Failed to submit test:', err);
      alert('Failed to submit test. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number | null): string => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-center items-center text-slate-800 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 font-medium">Securing Assessment Session &amp; Loading Questions...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F8FC] flex flex-col items-center justify-center text-slate-800 space-y-4">
        <p className="text-slate-600 font-medium">No questions found for this exam attempt.</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold cursor-pointer">
          Return to Portal
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col select-none">
      {/* Security Warning Toast */}
      {securityWarningMessage && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 px-6 py-2.5 flex items-center justify-between text-xs sticky top-0 z-50 animate-pulse">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{securityWarningMessage} {tabSwitchWarnings > 0 && `(Audit Incident #${tabSwitchWarnings})`}</span>
          </div>
          <button
            onClick={() => setSecurityWarningMessage(null)}
            className="text-rose-700 hover:text-rose-900 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Exam Header — Two-tier: branding bar + exam controls bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        {/* Tier 1: College Branding Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <CollegeBranding size="sm" showMarathi={false} />
            <span className="hidden sm:inline-block text-[11px] font-bold text-slate-700 uppercase tracking-widest flex-shrink-0">
              Online Examination Portal
            </span>
          </div>
        </div>

        {/* Tier 2: Exam-specific controls bar */}
        <div className="px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {subjectName}
                </span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-600 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                  <span>Anti-Cheating Monitored</span>
                </span>
              </div>
              <h1 className="text-base font-bold text-slate-900 tracking-wide truncate">
                {examTitle}
                {studentInfo && (
                  <span className="text-xs text-slate-500 font-normal ml-2 font-mono">
                    • {studentInfo.name} ({studentInfo.enrollment_no})
                  </span>
                )}
              </h1>
            </div>

            <div className="flex items-center space-x-3 flex-shrink-0">
              {/* Fullscreen Button */}
              {!isFullscreen && (
                <button
                  onClick={enterFullscreen}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  title="Enable Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Fullscreen</span>
                </button>
              )}

              {/* Timer */}
              <div className={`px-4 py-2 rounded-xl border flex items-center space-x-2 font-mono font-bold text-sm ${
                remainingSeconds !== null && remainingSeconds < 300
                  ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-blue-700'
              }`}>
                <Clock className="w-4 h-4" />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>

              {/* Submit Button */}
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={submitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50 text-sm cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit Exam</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Area (Left 3 columns) */}
        <div className="lg:col-span-3 space-y-6 flex flex-col justify-between">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-slate-400">Single Choice MCQ</span>
            </div>

            {/* Question Text */}
            <h2 className="text-lg md:text-xl font-medium text-slate-900 leading-relaxed">
              {currentQ.question}
            </h2>

            {/* Options */}
            <div className="space-y-3 pt-2">
              {Object.entries(currentQ.options).map(([optKey, optText]) => {
                const isSelected = answers[currentQ.id] === optKey;
                return (
                  <button
                    key={optKey}
                    type="button"
                    onClick={() => handleSelectAnswer(optKey)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start space-x-3.5 group cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-400/20'
                        : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-white'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-300 group-hover:border-slate-400'
                    }`}>
                      {optKey}
                    </span>
                    <span className="text-sm md:text-base leading-snug pt-0.5">{optText}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs text-slate-500 font-medium">
              {answeredCount} of {questions.length} Answered
            </span>

            {isLastQuestion ? (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <span>Review &amp; Submit</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Question Palette Sidebar (Right 1 column) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm flex flex-col h-full">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Question Navigator</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click any number to jump directly</p>
          </div>

          <div className="grid grid-cols-5 gap-2 max-h-[380px] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                    isCurrent
                      ? 'ring-2 ring-blue-500 bg-blue-600 text-white'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs space-y-2 text-slate-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />
                <span>Answered</span>
              </span>
              <span className="font-bold text-emerald-700">{answeredCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" />
                <span>Unanswered</span>
              </span>
              <span className="font-bold text-slate-500">{questions.length - answeredCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 text-blue-600">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Submit Examination?</h4>
                <p className="text-xs text-slate-500">Are you sure you want to finish?</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Questions:</span>
                <span className="font-bold text-slate-900">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Questions Answered:</span>
                <span className="font-bold text-emerald-700">{answeredCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Questions Left Blank:</span>
                <span className="font-bold text-amber-700">{questions.length - answeredCount}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Return to Exam
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={submitting}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StudentTest;
