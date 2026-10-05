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
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Securing Assessment Session & Loading Questions...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <p>No questions found for this exam attempt.</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">
          Return to Portal
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Security Warning Toast */}
      {securityWarningMessage && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 text-rose-200 px-6 py-2.5 flex items-center justify-between text-xs sticky top-0 z-50 animate-pulse">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-semibold">{securityWarningMessage} {tabSwitchWarnings > 0 && `(Audit Incident #${tabSwitchWarnings})`}</span>
          </div>
          <button
            onClick={() => setSecurityWarningMessage(null)}
            className="text-rose-400 hover:text-white font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20">
                {subjectName}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
                <span>Anti-Cheating Monitored</span>
              </span>
            </div>
            <h1 className="text-lg font-bold text-white tracking-wide">
              {examTitle}
              {studentInfo && (
                <span className="text-xs text-slate-400 font-normal ml-2 font-mono">
                  • {studentInfo.name} ({studentInfo.enrollment_no})
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Fullscreen Button */}
            {!isFullscreen && (
              <button
                onClick={enterFullscreen}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                title="Enable Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fullscreen</span>
              </button>
            )}

            {/* Server-Side Timer Indicator */}
            <div className={`px-4 py-2 rounded-xl border flex items-center space-x-2 font-mono font-bold text-sm ${
              remainingSeconds !== null && remainingSeconds < 300
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-sky-400'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition-all disabled:opacity-50 text-sm"
            >
              <Send className="w-4 h-4" />
              <span>Submit Exam</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Area (Left 3 columns) */}
        <div className="lg:col-span-3 space-y-6 flex flex-col justify-between">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-slate-500">Single Choice MCQ</span>
            </div>

            {/* Question Text */}
            <h2 className="text-lg md:text-xl font-medium text-white leading-relaxed">
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
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start space-x-3.5 group ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500 text-white shadow-md shadow-sky-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 border ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700 group-hover:border-slate-600'
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
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <span>Review & Submit</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Question Palette Sidebar (Right 1 column) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl flex flex-col h-full">
          <div>
            <h3 className="text-sm font-bold text-white">Question Navigator</h3>
            <p className="text-xs text-slate-400 mt-0.5">Click any number to jump directly</p>
          </div>

          <div className="grid grid-cols-5 gap-2 max-h-[380px] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'ring-2 ring-sky-400 bg-sky-500 text-white'
                      : isAnswered
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs space-y-2 text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500/60 inline-block" />
                <span>Answered</span>
              </span>
              <span className="font-bold text-emerald-400">{answeredCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-slate-950 border border-slate-800 inline-block" />
                <span>Unanswered</span>
              </span>
              <span className="font-bold text-slate-400">{questions.length - answeredCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 text-sky-400">
              <div className="p-3 bg-sky-500/10 rounded-2xl border border-sky-500/20">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Submit Examination?</h4>
                <p className="text-xs text-slate-400">Are you sure you want to finish?</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Questions:</span>
                <span className="font-bold text-white">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Questions Answered:</span>
                <span className="font-bold text-emerald-400">{answeredCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Questions Left Blank:</span>
                <span className="font-bold text-amber-400">{questions.length - answeredCount}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Return to Exam
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={submitting}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all"
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
