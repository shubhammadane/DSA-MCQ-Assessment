import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CheckCircle2, Award, Percent, LogOut, Download, FileText,
  UserCheck, Search, Eye, HelpCircle, Sliders, Plus, Edit3, Power,
  AlertTriangle, Check, X, Shield, RefreshCw, Trash2
} from 'lucide-react';
import api, { API_BASE_URL } from '../services/api';
import type { AdminStats, StudentSummary, AdminQuestion, AssessmentSettings } from '../types';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Active Tab: 'students' | 'questions' | 'settings' | 'exports'
  const [activeTab, setActiveTab] = useState<'students' | 'questions' | 'settings' | 'exports'>('students');

  // Stats & Students
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Question Management State
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Question Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [deactivatingQuestion, setDeactivatingQuestion] = useState<AdminQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<AdminQuestion | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [questionNotification, setQuestionNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Question Form
  const [formQuestionText, setFormQuestionText] = useState('');
  const [formOptA, setFormOptA] = useState('');
  const [formOptB, setFormOptB] = useState('');
  const [formOptC, setFormOptC] = useState('');
  const [formOptD, setFormOptD] = useState('');
  const [formCorrectAns, setFormCorrectAns] = useState('A');
  const [formTopic, setFormTopic] = useState('Data Structures & Algorithms');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Assessment Settings State
  const [settingsData, setSettingsData] = useState<AssessmentSettings | null>(null);
  const [settingsQuestionCount, setSettingsQuestionCount] = useState<number>(50);
  const [settingsTimeLimit, setSettingsTimeLimit] = useState<number>(60);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [statsRes, studentsRes] = await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/admin/students')
        ]);
        setStats(statsRes.data);
        setStudents(studentsRes.data);
      } catch (err: any) {
        console.error('Failed to load admin dashboard data:', err);
        if (err.response?.status === 401) {
          localStorage.removeItem('admin_token');
          navigate('/admin/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // Load questions when Question Management tab is selected
  const loadQuestions = async () => {
    setQuestionsLoading(true);
    try {
      const res = await api.get('/admin/questions');
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to load admin questions:', err);
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Load settings when Assessment Settings tab is selected
  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await api.get<AssessmentSettings>('/admin/assessment-settings');
      setSettingsData(res.data);
      setSettingsQuestionCount(res.data.question_count);
      setSettingsTimeLimit(res.data.time_limit_minutes);
    } catch (err) {
      console.error('Failed to load assessment settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'questions') {
      loadQuestions();
    } else if (activeTab === 'settings') {
      loadSettings();
    }
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  const handleExportSummaryExcel = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`${API_BASE_URL}/admin/export/excel?type=summary&token=${token}`, '_blank');
  };

  const handleExportDetailedExcel = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`${API_BASE_URL}/admin/export/excel?type=detailed&token=${token}`, '_blank');
  };

  const handleExportSummaryCSV = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`${API_BASE_URL}/admin/export/csv?type=summary&token=${token}`, '_blank');
  };

  const handleExportDetailedCSV = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`${API_BASE_URL}/admin/export/csv?type=detailed&token=${token}`, '_blank');
  };

  // Question Form Handlers
  const openAddModal = () => {
    setEditingQuestion(null);
    setFormQuestionText('');
    setFormOptA('');
    setFormOptB('');
    setFormOptC('');
    setFormOptD('');
    setFormCorrectAns('A');
    setFormTopic('Data Structures & Algorithms');
    setFormIsActive(true);
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (q: AdminQuestion) => {
    setEditingQuestion(q);
    setFormQuestionText(q.question_text);
    setFormOptA(q.option_a);
    setFormOptB(q.option_b);
    setFormOptC(q.option_c);
    setFormOptD(q.option_d);
    setFormCorrectAns(q.correct_answer);
    setFormTopic(q.topic || 'Data Structures & Algorithms');
    setFormIsActive(q.is_active);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestionText.trim() || !formOptA.trim() || !formOptB.trim() || !formOptC.trim() || !formOptD.trim()) {
      setFormError('Question text and all four options (A, B, C, D) are required.');
      return;
    }
    if (!['A', 'B', 'C', 'D'].includes(formCorrectAns)) {
      setFormError('Correct answer must be A, B, C, or D.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      question_text: formQuestionText.trim(),
      option_a: formOptA.trim(),
      option_b: formOptB.trim(),
      option_c: formOptC.trim(),
      option_d: formOptD.trim(),
      correct_answer: formCorrectAns,
      topic: formTopic.trim() || 'Data Structures & Algorithms',
      is_active: formIsActive
    };

    try {
      if (editingQuestion) {
        await api.put(`/admin/questions/${editingQuestion.id}`, payload);
      } else {
        await api.post('/admin/questions', payload);
      }
      setShowAddModal(false);
      await loadQuestions();
    } catch (err: any) {
      console.error('Failed to save question:', err);
      setFormError(err.response?.data?.detail || 'Failed to save question. Please check input values.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (q: AdminQuestion) => {
    try {
      const newStatus = !q.is_active;
      await api.patch(`/admin/questions/${q.id}/status`, { is_active: newStatus });
      setQuestionNotification({
        type: 'success',
        message: `Question #${q.id} ${newStatus ? 'reactivated' : 'deactivated'} successfully.`
      });
      await loadQuestions();
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
      setQuestionNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to update question status.'
      });
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivatingQuestion) return;
    try {
      await api.patch(`/admin/questions/${deactivatingQuestion.id}/status`, { is_active: false });
      setQuestionNotification({
        type: 'success',
        message: `Question #${deactivatingQuestion.id} deactivated successfully. It will not appear in new assessments.`
      });
      setDeactivatingQuestion(null);
      await loadQuestions();
    } catch (err: any) {
      console.error('Failed to deactivate question:', err);
      setQuestionNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to deactivate question.'
      });
      setDeactivatingQuestion(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingQuestion) return;
    setDeleteSubmitting(true);
    try {
      const res = await api.delete(`/admin/questions/${deletingQuestion.id}`);
      const successMsg = res.data?.message || `Question #${deletingQuestion.id} permanently deleted successfully.`;
      setDeletingQuestion(null);
      setQuestionNotification({ type: 'success', message: successMsg });
      await loadQuestions();
    } catch (err: any) {
      console.error('Failed to delete question:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to permanently delete question.';
      setDeletingQuestion(null);
      setQuestionNotification({ type: 'error', message: errorMsg });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Assessment Settings Save Handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMessage(null);

    if (settingsQuestionCount <= 0) {
      setSettingsMessage({ type: 'error', text: 'Number of questions must be at least 1.' });
      return;
    }
    if (settingsTimeLimit <= 0) {
      setSettingsMessage({ type: 'error', text: 'Time limit must be at least 1 minute.' });
      return;
    }

    setSettingsSaving(true);
    try {
      const res = await api.put<AssessmentSettings>('/admin/assessment-settings', {
        question_count: Number(settingsQuestionCount),
        time_limit_minutes: Number(settingsTimeLimit)
      });
      setSettingsData(res.data);
      setSettingsMessage({
        type: 'success',
        text: `Settings updated successfully! New attempts will use ${res.data.question_count} questions with a ${res.data.time_limit_minutes}-minute limit.`
      });
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setSettingsMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to save settings. Please verify inputs.'
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.enrollment_no.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q);
  });

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    if (statusFilter === 'active' && !q.is_active) return false;
    if (statusFilter === 'inactive' && q.is_active) return false;

    if (!questionSearch.trim()) return true;
    const s = questionSearch.toLowerCase();
    return (
      q.question_text.toLowerCase().includes(s) ||
      q.option_a.toLowerCase().includes(s) ||
      q.option_b.toLowerCase().includes(s) ||
      q.option_c.toLowerCase().includes(s) ||
      q.option_d.toLowerCase().includes(s) ||
      (q.topic && q.topic.toLowerCase().includes(s))
    );
  });

  const activeQuestionsCount = questions.filter((q) => q.is_active).length;
  const inactiveQuestionsCount = questions.filter((q) => !q.is_active).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Loading Admin Analytics & Assessment Control Panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">Admin Management Dashboard</h1>
            <p className="text-xs text-slate-400">DSA MCQ Assessment Control Panel</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs flex items-center space-x-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all ${
              activeTab === 'students'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Students & Results</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all ${
              activeTab === 'questions'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Question Management</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Assessment Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('exports')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all ${
              activeTab === 'exports'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Data Exports</span>
          </button>
        </div>

        {/* ==================== TAB 1: STUDENTS & RESULTS ==================== */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-indigo-400">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Students</span>
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-black text-white">{stats.total_students}</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-sky-400">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Attempts</span>
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-black text-white">{stats.total_attempts}</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Completed Tests</span>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-black text-white">{stats.completed_tests}</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-amber-400">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Class Average Score</span>
                    <Award className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-black text-white">{stats.average_score}</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-purple-400">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Class Average %</span>
                    <Percent className="w-5 h-5" />
                  </div>
                  <p className="text-3xl font-black text-purple-400">{stats.average_percentage}%</p>
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Student Assessment Records</h2>
                  <p className="text-xs text-slate-400">Filter students and inspect full question performance</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportSummaryExcel}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-600/20"
                    title="Download Summary results in Excel format"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Summary (Excel)</span>
                  </button>

                  <button
                    onClick={handleExportSummaryCSV}
                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-teal-600/20"
                    title="Download Summary results in CSV format"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Summary (CSV)</span>
                  </button>

                  <button
                    onClick={handleExportDetailedExcel}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/20"
                    title="Download Question-by-Question detailed answers in Excel format"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Answers (Excel)</span>
                  </button>

                  <button
                    onClick={handleExportDetailedCSV}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-purple-600/20"
                    title="Download Question-by-Question detailed answers in CSV format"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Answers (CSV)</span>
                  </button>
                </div>
              </div>

              <div className="relative max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by Enrollment No, Name, or Department..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3.5 px-4">Enrollment No</th>
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Score</th>
                      <th className="py-3.5 px-4">Percentage</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Attempt Date</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No student records match the search query.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => (
                        <tr key={s.student_id} className="hover:bg-slate-850/50 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-sky-400">{s.enrollment_no}</td>
                          <td className="py-3.5 px-4 font-medium text-white">{s.name}</td>
                          <td className="py-3.5 px-4 text-slate-300">{s.department}</td>
                          <td className="py-3.5 px-4 font-bold text-white">
                            {s.score !== null ? s.score : '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            {s.percentage !== null ? (
                              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                {s.percentage}%
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">Pending</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold">
                            {s.status === 'completed' ? (
                              <span className="text-emerald-400">Completed</span>
                            ) : s.status === 'timed_out' ? (
                              <span className="text-amber-400">Timed Out</span>
                            ) : s.status === 'in_progress' ? (
                              <span className="text-sky-400">In Progress</span>
                            ) : (
                              <span className="text-slate-500">Not Attempted</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400">
                            {s.attempt_date ? new Date(s.attempt_date).toLocaleString() : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {(s.status === 'completed' || s.status === 'timed_out') && s.student_id ? (
                              <button
                                onClick={() => navigate(`/admin/student/${s.student_id}`)}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-600">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: QUESTION MANAGEMENT ==================== */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            {/* Stats row for questions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Questions</span>
                  <p className="text-3xl font-black text-white mt-1">{questions.length}</p>
                </div>
                <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                  <HelpCircle className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Active Questions</span>
                  <p className="text-3xl font-black text-emerald-400 mt-1">{activeQuestionsCount}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Inactive Questions</span>
                  <p className="text-3xl font-black text-rose-400 mt-1">{inactiveQuestionsCount}</p>
                </div>
                <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                  <Power className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Questions Table Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              {/* Notification Banner */}
              {questionNotification && (
                <div className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
                  questionNotification.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center space-x-2.5">
                    {questionNotification.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-semibold">{questionNotification.message}</span>
                  </div>
                  <button
                    onClick={() => setQuestionNotification(null)}
                    className="text-slate-400 hover:text-white p-1 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Question Bank Management</h2>
                  <p className="text-xs text-slate-400">
                    Add, edit, deactivate, or delete assessment questions. Deactivated questions will not appear in new assessments.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={loadQuestions}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                    title="Refresh Questions List"
                  >
                    <RefreshCw className={`w-4 h-4 ${questionsLoading ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={openAddModal}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Question</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[260px]">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    placeholder="Search by question text, options, or topic..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                      statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({questions.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                      statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Active ({activeQuestionsCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('inactive')}
                    className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                      statusFilter === 'inactive' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Inactive ({inactiveQuestionsCount})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3.5 px-4 w-12">ID</th>
                      <th className="py-3.5 px-4 min-w-[280px]">Question</th>
                      <th className="py-3.5 px-4 min-w-[240px]">Options</th>
                      <th className="py-3.5 px-4 w-20 text-center">Correct</th>
                      <th className="py-3.5 px-4 w-28 text-center">Status</th>
                      <th className="py-3.5 px-4 w-36 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {questionsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Loading questions...
                        </td>
                      </tr>
                    ) : filteredQuestions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No questions match the current filter or search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredQuestions.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-850/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-sky-400">{q.id}</td>
                          <td className="py-3.5 px-4">
                            <p className="font-medium text-white line-clamp-2">{q.question_text}</p>
                            {q.topic && (
                              <span className="inline-block mt-1 text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                {q.topic}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-300 space-y-1">
                            <div className="line-clamp-1"><span className="font-bold text-slate-400">A:</span> {q.option_a}</div>
                            <div className="line-clamp-1"><span className="font-bold text-slate-400">B:</span> {q.option_b}</div>
                            <div className="line-clamp-1"><span className="font-bold text-slate-400">C:</span> {q.option_c}</div>
                            <div className="line-clamp-1"><span className="font-bold text-slate-400">D:</span> {q.option_d}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-xs">
                              {q.correct_answer}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {q.is_active ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                Active
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center space-x-1.5">
                              {/* Edit Question */}
                              <button
                                onClick={() => openEditModal(q)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors"
                                title="Edit Question"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Activate / Deactivate */}
                              {q.is_active ? (
                                <button
                                  onClick={() => setDeactivatingQuestion(q)}
                                  className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors"
                                  title="Deactivate Question"
                                >
                                  <Power className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(q)}
                                  className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors"
                                  title="Reactivate Question"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}

                              {/* Delete Question */}
                              <button
                                onClick={() => {
                                  setQuestionNotification(null);
                                  setDeletingQuestion(q);
                                }}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                                title="Delete Question Permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: ASSESSMENT SETTINGS ==================== */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Assessment Configuration</h2>
                  <p className="text-xs text-slate-400">
                    Configure question count and examination duration. Applied dynamically to all NEW student attempts.
                  </p>
                </div>
              </div>

              {settingsMessage && (
                <div
                  className={`p-4 rounded-xl border text-sm flex items-start space-x-3 ${
                    settingsMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {settingsMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{settingsMessage.text}</span>
                </div>
              )}

              {settingsLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Loading Assessment Settings...
                </div>
              ) : (
                <>
                  {settingsData && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-500 block">Total Questions in Bank</span>
                        <span className="font-bold text-white text-base">{settingsData.total_questions_count}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Active Questions Available</span>
                        <span className="font-bold text-emerald-400 text-base">{settingsData.active_questions_count}</span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Number of Questions per Assessment *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={settingsData ? settingsData.active_questions_count : 100}
                        value={settingsQuestionCount}
                        onChange={(e) => setSettingsQuestionCount(parseInt(e.target.value, 10) || 0)}
                        required
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-base font-semibold"
                      />
                      <p className="text-xs text-slate-500 mt-1.5">
                        Must be &gt; 0 and cannot exceed active questions in bank ({settingsData?.active_questions_count || 50}).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Time Limit (Minutes) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={360}
                        value={settingsTimeLimit}
                        onChange={(e) => setSettingsTimeLimit(parseInt(e.target.value, 10) || 0)}
                        required
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-base font-semibold"
                      />
                      <p className="text-xs text-slate-500 mt-1.5">
                        Examples: 30 mins, 45 mins, 60 mins, 90 mins, 120 mins. Enforced both client-side and server-side.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                      <button
                        type="submit"
                        disabled={settingsSaving}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center space-x-2"
                      >
                        {settingsSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Saving Settings...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Save Assessment Settings</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: EXPORTS ==================== */}
        {activeTab === 'exports' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Assessment Data Exports</h2>
                <p className="text-xs text-slate-400">
                  Export college-grade student examination records in Excel (.xlsx) and CSV formats.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Summary Results (Excel)</h3>
                      <p className="text-xs text-slate-400">Enrollment No, Name, Dept, Score, Percentage</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExportSummaryExcel}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Excel Workbook</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Summary Results (CSV)</h3>
                      <p className="text-xs text-slate-400">Universal comma-separated student grades</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExportSummaryCSV}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-teal-600/20 flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV Sheet</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Detailed Answers (Excel)</h3>
                      <p className="text-xs text-slate-400">Question-by-question response audit log</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExportDetailedExcel}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Download Detailed Answers Excel</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Detailed Answers (CSV)</h3>
                      <p className="text-xs text-slate-400">Question-by-question response in CSV</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExportDetailedCSV}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Download Detailed Answers CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================== ADD / EDIT QUESTION MODAL ==================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {editingQuestion ? `Edit Question #${editingQuestion.id}` : 'Add New Question'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Question Text *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formQuestionText}
                  onChange={(e) => setFormQuestionText(e.target.value)}
                  placeholder="Enter the full question statement..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Option A *
                  </label>
                  <input
                    type="text"
                    required
                    value={formOptA}
                    onChange={(e) => setFormOptA(e.target.value)}
                    placeholder="Option A statement"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Option B *
                  </label>
                  <input
                    type="text"
                    required
                    value={formOptB}
                    onChange={(e) => setFormOptB(e.target.value)}
                    placeholder="Option B statement"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Option C *
                  </label>
                  <input
                    type="text"
                    required
                    value={formOptC}
                    onChange={(e) => setFormOptC(e.target.value)}
                    placeholder="Option C statement"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Option D *
                  </label>
                  <input
                    type="text"
                    required
                    value={formOptD}
                    onChange={(e) => setFormOptD(e.target.value)}
                    placeholder="Option D statement"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Authoritative Correct Answer *
                  </label>
                  <select
                    value={formCorrectAns}
                    onChange={(e) => setFormCorrectAns(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Topic / Unit (Optional)
                  </label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="e.g. Stacks, Trees, Graphs"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="formIsActive" className="text-xs text-slate-300 cursor-pointer">
                  Active (Available for new student assessments)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DEACTIVATE CONFIRMATION MODAL ==================== */}
      {deactivatingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-amber-500/10 text-amber-400 rounded-full mb-2">
                <Power className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Deactivate Question #{deactivatingQuestion.id}?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This question will be marked as inactive and will NOT be included in new student assessments.
              </p>
              <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 mt-2">
                ✓ All historical student attempts referencing this question remain 100% preserved and intact.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setDeactivatingQuestion(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeactivate}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION MODAL ==================== */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-rose-500/10 text-rose-500 rounded-full mb-1">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Question?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to permanently delete this question?
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-400">Question ID:</span>
                <span className="font-mono text-indigo-400 font-bold">#{deletingQuestion.id}</span>
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-400 block mb-1">Preview:</span>
                <p className="text-slate-200 line-clamp-3 text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  {deletingQuestion.question_text}
                </p>
              </div>
              <div className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-start space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Notice: Questions referenced in student exam attempts cannot be deleted to preserve exam integrity. Deactivate instead.</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setDeletingQuestion(null)}
                disabled={deleteSubmitting}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteSubmitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-red-600/30 flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteSubmitting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

