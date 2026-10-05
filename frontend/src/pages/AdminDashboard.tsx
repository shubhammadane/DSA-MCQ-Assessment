import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CheckCircle2, LogOut, Download, FileText,
  UserCheck, Search, Eye, HelpCircle, Sliders, Plus, Edit3, Power,
  AlertTriangle, X, Shield, RefreshCw, Trash2, BookOpen,
  GraduationCap, Building, Layers, Calendar, UserPlus,
  UploadCloud, FileSpreadsheet, ShieldAlert
} from 'lucide-react';
import api, { API_BASE_URL } from '../services/api';
import type {
  AdminStats, StudentSummary, AdminQuestion, AssessmentSettings,
  Department, Program, AcademicYear, Semester, Subject, Exam, AssignedStudent, Student
} from '../types';

type DashboardTab = 'overview' | 'academic' | 'students' | 'subjects' | 'questions' | 'exams' | 'records' | 'settings' | 'exports';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // Stats & Loading
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Global Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Academic Structure State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  // Subject Management State (MANUALLY ADDED ONLY)
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectDeptFilter, setSubjectDeptFilter] = useState<string>('');
  const [subjectStatusFilter, setSubjectStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [subjectFormName, setSubjectFormName] = useState('');
  const [subjectFormCode, setSubjectFormCode] = useState('');
  const [subjectFormDeptId, setSubjectFormDeptId] = useState<number>(0);
  const [subjectFormProgId, setSubjectFormProgId] = useState<number | undefined>();
  const [subjectFormYearId, setSubjectFormYearId] = useState<number | undefined>();
  const [subjectFormSemId, setSubjectFormSemId] = useState<number | undefined>();

  // Student Management State
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDeptFilter, setStudentDeptFilter] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDept, setImportDept] = useState('');
  const [importProg, setImportProg] = useState('UG');
  const [importYear, setImportYear] = useState('1st Year');
  const [importSem, setImportSem] = useState('Semester 1');
  const [importLoading, setImportLoading] = useState(false);

  // Student Form
  const [stFormEnrollment, setStFormEnrollment] = useState('');
  const [stFormName, setStFormName] = useState('');
  const [stFormGender, setStFormGender] = useState('Male');
  const [stFormDept, setStFormDept] = useState('');
  const [stFormProg, setStFormProg] = useState('UG');
  const [stFormYear, setStFormYear] = useState('1st Year');
  const [stFormSem, setStFormSem] = useState('Semester 1');
  const [stFormPassword, setStFormPassword] = useState('student123');

  // Question Management State
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState('');
  const [questionDeptFilter, setQuestionDeptFilter] = useState('');
  const [questionStatusFilter, setQuestionStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<AdminQuestion | null>(null);

  // Question Form
  const [qFormText, setQFormText] = useState('');
  const [qFormOptA, setQFormOptA] = useState('');
  const [qFormOptB, setQFormOptB] = useState('');
  const [qFormOptC, setQFormOptC] = useState('');
  const [qFormOptD, setQFormOptD] = useState('');
  const [qFormCorrect, setQFormCorrect] = useState('A');
  const [qFormTopic, setQFormTopic] = useState('Data Structures');
  const [qFormDifficulty, setQFormDifficulty] = useState('Medium');
  const [qFormMarks, setQFormMarks] = useState<number>(1);
  const [qFormSubjectId, setQFormSubjectId] = useState<number | undefined>();
  const [qFormDeptId, setQFormDeptId] = useState<number | undefined>();

  // Exam Management State
  const [exams, setExams] = useState<Exam[]>([]);
  const [examSearch, setExamSearch] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState('');
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [assigningExam, setAssigningExam] = useState<Exam | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<AssignedStudent[]>([]);
  const [selectedStudentIdsToAssign, setSelectedStudentIdsToAssign] = useState<number[]>([]);
  const [assignFilterDept, setAssignFilterDept] = useState('');
  const [assignSearch, setAssignSearch] = useState('');

  // Exam Form
  const [examFormTitle, setExamFormTitle] = useState('');
  const [examFormCode, setExamFormCode] = useState('');
  const [examFormSubjectId, setExamFormSubjectId] = useState<number | undefined>();
  const [examFormDeptId, setExamFormDeptId] = useState<number | undefined>();
  const [examFormDuration, setExamFormDuration] = useState<number>(60);
  const [examFormQuestionsCount, setExamFormQuestionsCount] = useState<number>(25);
  const [examFormMarksPerQ, setExamFormMarksPerQ] = useState<number>(1);
  const [examFormPassingPct, setExamFormPassingPct] = useState<number>(40);
  const [examFormSelectionMode, setExamFormSelectionMode] = useState<'random' | 'manual'>('random');
  const [examFormStatus, setExamFormStatus] = useState<string>('published');
  const [examFormStartDate, setExamFormStartDate] = useState('');
  const [examFormEndDate, setExamFormEndDate] = useState('');

  // Student Assessment Records State
  const [studentRecords, setStudentRecords] = useState<StudentSummary[]>([]);
  const [recordsSearch, setRecordsSearch] = useState('');
  const [recordsDeptFilter, setRecordsDeptFilter] = useState('');
  const [deletingAttempt, setDeletingAttempt] = useState<StudentSummary | null>(null);
  const [inspectingAttempt, setInspectingAttempt] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Assessment Settings State
  const [settingsData, setSettingsData] = useState<AssessmentSettings | null>(null);
  const [settingsQuestionCount, setSettingsQuestionCount] = useState<number>(50);
  const [settingsTimeLimit, setSettingsTimeLimit] = useState<number>(60);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Authentication check & initial load
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    loadOverview();
  }, [navigate]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [statsRes, structureRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/academic-structure')
      ]);
      setStats(statsRes.data);
      setDepartments(structureRes.data.departments || []);
      setPrograms(structureRes.data.programs || []);
      setAcademicYears(structureRes.data.years || []);
      setSemesters(structureRes.data.semesters || []);
      if (structureRes.data.departments?.length > 0) {
        setImportDept(structureRes.data.departments[0].name);
        setStFormDept(structureRes.data.departments[0].name);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token');
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load section-specific data on tab switch
  useEffect(() => {
    if (activeTab === 'academic') {
      loadAcademicData();
    } else if (activeTab === 'subjects') {
      loadSubjects();
    } else if (activeTab === 'students') {
      loadStudents();
    } else if (activeTab === 'questions') {
      loadQuestions();
      loadSubjects();
    } else if (activeTab === 'exams') {
      loadExams();
      loadSubjects();
    } else if (activeTab === 'records') {
      loadRecords();
    } else if (activeTab === 'settings') {
      loadSettings();
    }
  }, [activeTab]);

  const loadAcademicData = async () => {
    try {
      const res = await api.get('/academic-structure');
      setDepartments(res.data.departments || []);
      setPrograms(res.data.programs || []);
      setAcademicYears(res.data.years || []);
      setSemesters(res.data.semesters || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubjects = async () => {
    try {
      const res = await api.get('/subjects');
      setSubjects(res.data);
      if (res.data.length > 0 && !subjectFormDeptId && departments.length > 0) {
        setSubjectFormDeptId(departments[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await api.get('/admin/students/list');
      setStudentsList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadQuestions = async () => {
    try {
      const res = await api.get('/admin/questions');
      setQuestions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadExams = async () => {
    try {
      const res = await api.get('/admin/exams');
      setExams(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRecords = async () => {
    try {
      const res = await api.get('/admin/students');
      setStudentRecords(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await api.get<AssessmentSettings>('/admin/assessment-settings');
      setSettingsData(res.data);
      setSettingsQuestionCount(res.data.question_count);
      setSettingsTimeLimit(res.data.time_limit_minutes);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  // Department Handlers
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      await api.post('/departments', { name: newDeptName.trim(), code: newDeptCode.trim() || undefined });
      showNotice('success', `Department '${newDeptName}' created successfully.`);
      setShowAddDeptModal(false);
      setNewDeptName('');
      setNewDeptCode('');
      loadAcademicData();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to create department.');
    }
  };

  const handleToggleDeptStatus = async (dept: Department) => {
    try {
      await api.patch(`/departments/${dept.id}/status`, { is_active: !dept.is_active });
      showNotice('success', `Department '${dept.name}' ${!dept.is_active ? 'activated' : 'deactivated'}.`);
      loadAcademicData();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update department status.');
    }
  };

  // Subject Handlers
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectFormName.trim() || !subjectFormCode.trim() || !subjectFormDeptId) {
      showNotice('error', 'Subject Name, Code, and Department are required.');
      return;
    }

    try {
      const payload = {
        name: subjectFormName.trim(),
        code: subjectFormCode.trim(),
        department_id: subjectFormDeptId,
        program_id: subjectFormProgId || undefined,
        academic_year_id: subjectFormYearId || undefined,
        semester_id: subjectFormSemId || undefined,
        is_active: true
      };

      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}`, payload);
        showNotice('success', `Subject '${subjectFormName}' updated successfully.`);
      } else {
        await api.post('/subjects', payload);
        showNotice('success', `Subject '${subjectFormName}' created successfully.`);
      }

      setShowAddSubjectModal(false);
      setEditingSubject(null);
      setSubjectFormName('');
      setSubjectFormCode('');
      loadSubjects();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to save subject.');
    }
  };

  const handleToggleSubjectStatus = async (subj: Subject) => {
    try {
      await api.patch(`/subjects/${subj.id}/status`, { is_active: !subj.is_active });
      showNotice('success', `Subject '${subj.name}' ${!subj.is_active ? 'activated' : 'deactivated'}.`);
      loadSubjects();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update subject status.');
    }
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    try {
      await api.delete(`/subjects/${deletingSubject.id}`);
      showNotice('success', `Subject '${deletingSubject.name}' deleted successfully.`);
      setDeletingSubject(null);
      loadSubjects();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete subject.');
      setDeletingSubject(null);
    }
  };

  // Student Handlers
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stFormEnrollment.trim() || !stFormName.trim() || !stFormDept.trim()) {
      showNotice('error', 'Enrollment Number, Name, and Department are required.');
      return;
    }

    try {
      const payload = {
        enrollment_no: stFormEnrollment.trim(),
        name: stFormName.trim(),
        gender: stFormGender,
        department: stFormDept,
        program: stFormProg,
        year: stFormYear,
        semester: stFormSem,
        password: stFormPassword.trim() || undefined
      };

      if (editingStudent) {
        await api.put(`/admin/students/${editingStudent.id}`, payload);
        showNotice('success', `Student '${stFormName}' updated.`);
      } else {
        await api.post('/admin/students', payload);
        showNotice('success', `Student '${stFormName}' registered with secure credentials.`);
      }

      setShowAddStudentModal(false);
      setEditingStudent(null);
      setStFormEnrollment('');
      setStFormName('');
      loadStudents();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to save student.');
    }
  };

  const handleToggleStudentStatus = async (st: Student) => {
    try {
      await api.patch(`/admin/students/${st.id}/status`, { is_active: !st.is_active });
      showNotice('success', `Student '${st.name}' ${!st.is_active ? 'activated' : 'deactivated'}.`);
      loadStudents();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update student.');
    }
  };

  const handleBulkImportStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      showNotice('error', 'Please select a CSV, Excel (.xlsx), or PDF roll list file.');
      return;
    }
    if (!importDept) {
      showNotice('error', 'Department selection is required.');
      return;
    }

    setImportLoading(true);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('department', importDept);
    formData.append('program', importProg);
    formData.append('year', importYear);
    formData.append('semester', importSem);

    try {
      const res = await api.post('/admin/students/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showNotice('success', res.data.message || 'Students imported successfully.');
      setShowBulkImportModal(false);
      setImportFile(null);
      loadStudents();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Student bulk import failed.');
    } finally {
      setImportLoading(false);
    }
  };

  // Question Handlers
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qFormText.trim() || !qFormOptA.trim() || !qFormOptB.trim() || !qFormOptC.trim() || !qFormOptD.trim()) {
      showNotice('error', 'Question text and all four options are required.');
      return;
    }

    try {
      const payload = {
        question_text: qFormText.trim(),
        option_a: qFormOptA.trim(),
        option_b: qFormOptB.trim(),
        option_c: qFormOptC.trim(),
        option_d: qFormOptD.trim(),
        correct_answer: qFormCorrect,
        topic: qFormTopic.trim(),
        difficulty: qFormDifficulty,
        marks: qFormMarks,
        subject_id: qFormSubjectId || undefined,
        department_id: qFormDeptId || undefined,
        is_active: true
      };

      if (editingQuestion) {
        await api.put(`/admin/questions/${editingQuestion.id}`, payload);
        showNotice('success', `Question #${editingQuestion.id} updated.`);
      } else {
        await api.post('/admin/questions', payload);
        showNotice('success', 'Question added to question bank.');
      }

      setShowAddQuestionModal(false);
      setEditingQuestion(null);
      setQFormText('');
      setQFormOptA('');
      setQFormOptB('');
      setQFormOptC('');
      setQFormOptD('');
      loadQuestions();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to save question.');
    }
  };

  const handleToggleQuestionStatus = async (q: AdminQuestion) => {
    try {
      await api.patch(`/admin/questions/${q.id}/status`, { is_active: !q.is_active });
      showNotice('success', `Question #${q.id} ${!q.is_active ? 'activated' : 'deactivated'}.`);
      loadQuestions();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update question status.');
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deletingQuestion) return;
    try {
      await api.delete(`/admin/questions/${deletingQuestion.id}`);
      showNotice('success', `Question #${deletingQuestion.id} deleted permanently.`);
      setDeletingQuestion(null);
      loadQuestions();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete question.');
      setDeletingQuestion(null);
    }
  };

  // Exam Handlers & Student Assignment
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examFormTitle.trim()) {
      showNotice('error', 'Exam Title is required.');
      return;
    }

    try {
      const payload = {
        title: examFormTitle.trim(),
        code: examFormCode.trim() || undefined,
        subject_id: examFormSubjectId || undefined,
        department_id: examFormDeptId || undefined,
        duration_minutes: examFormDuration,
        total_questions: examFormQuestionsCount,
        marks_per_question: examFormMarksPerQ,
        total_marks: examFormQuestionsCount * examFormMarksPerQ,
        passing_percentage: examFormPassingPct,
        selection_mode: examFormSelectionMode,
        status: examFormStatus,
        start_date: examFormStartDate || undefined,
        end_date: examFormEndDate || undefined
      };

      if (editingExam) {
        await api.put(`/admin/exams/${editingExam.id}`, payload);
        showNotice('success', `Exam '${examFormTitle}' updated.`);
      } else {
        await api.post('/admin/exams', payload);
        showNotice('success', `Exam '${examFormTitle}' created successfully.`);
      }

      setShowCreateExamModal(false);
      setEditingExam(null);
      setExamFormTitle('');
      setExamFormCode('');
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to save exam.');
    }
  };

  const handleToggleExamStatus = async (exam: Exam, newStatus: string) => {
    try {
      await api.patch(`/admin/exams/${exam.id}/status?status_name=${newStatus}`, { is_active: true });
      showNotice('success', `Exam '${exam.title}' status changed to ${newStatus}.`);
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update exam status.');
    }
  };

  const openAssignModal = async (exam: Exam) => {
    setAssigningExam(exam);
    try {
      const stRes = await api.get<Student[]>('/admin/students/list');
      setStudentsList(stRes.data);

      const assignedRes = await api.get<AssignedStudent[]>(`/admin/exams/${exam.id}/students`);
      setAssignedStudents(assignedRes.data);
      setSelectedStudentIdsToAssign(assignedRes.data.map(s => s.student_id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveStudentAssignments = async () => {
    if (!assigningExam) return;
    try {
      const res = await api.post(`/admin/exams/${assigningExam.id}/assign`, {
        student_ids: selectedStudentIdsToAssign
      });
      showNotice('success', res.data.message || 'Student assignments updated successfully.');
      setAssigningExam(null);
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to assign students.');
    }
  };

  // Assessment Records & Attempt Deletion
  const handleInspectAttempt = async (rec: StudentSummary) => {
    if (!rec.student_id) return;
    setInspectLoading(true);
    try {
      const res = await api.get(`/admin/students/${rec.student_id}${rec.attempt_id ? `?attempt_id=${rec.attempt_id}` : ''}`);
      setInspectingAttempt(res.data);
    } catch (err: any) {
      showNotice('error', 'Failed to load attempt details.');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleDeleteAttempt = async () => {
    if (!deletingAttempt || !deletingAttempt.attempt_id) return;
    try {
      await api.delete(`/admin/attempts/${deletingAttempt.attempt_id}`);
      showNotice('success', `Assessment attempt #${deletingAttempt.attempt_id} deleted permanently.`);
      setDeletingAttempt(null);
      loadRecords();
      loadOverview();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete attempt.');
      setDeletingAttempt(null);
    }
  };

  // Settings Handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const res = await api.put('/admin/assessment-settings', {
        question_count: settingsQuestionCount,
        time_limit_minutes: settingsTimeLimit
      });
      setSettingsData(res.data);
      showNotice('success', 'Default assessment settings updated successfully.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleExportExcel = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`${API_BASE_URL}/admin/export/excel?token=${token}`, '_blank');
  };

  const handleExportCSV = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`${API_BASE_URL}/admin/export/csv?token=${token}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Loading Institutional Examination Management Desk...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Admin Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-sky-600 to-blue-500 rounded-xl shadow-lg shadow-sky-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <span>College Examination & Assessment System</span>
                <span className="text-[10px] px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded font-semibold uppercase">
                  Admin Panel
                </span>
              </h1>
              <p className="text-xs text-slate-400">Institutional Examination & Assessment Management Desk</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                loadOverview();
                showNotice('success', 'Dashboard synced with database.');
              }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Toast Notification */}
      {notification && (
        <div className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-sm font-medium border animate-in fade-in slide-in-from-top-4 ${
          notification.type === 'success'
            ? 'bg-emerald-950 border-emerald-500/40 text-emerald-200'
            : 'bg-rose-950 border-rose-500/40 text-rose-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Sub-header / Tabs */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 py-2">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'academic', label: 'Academic Structure', icon: Building },
            { id: 'students', label: 'Student Management', icon: Users },
            { id: 'subjects', label: 'Subject Management', icon: BookOpen },
            { id: 'questions', label: 'Question Bank', icon: HelpCircle },
            { id: 'exams', label: 'Exam Management', icon: Calendar },
            { id: 'records', label: 'Assessment Records', icon: UserCheck },
            { id: 'settings', label: 'Settings', icon: Sliders },
            { id: 'exports', label: 'Exports', icon: Download },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DashboardTab)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-6">

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Total Students</span>
                <div className="text-2xl font-black text-white">{stats?.total_students || 0}</div>
                <div className="text-[11px] text-sky-400">Enrolled Candidates</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Departments</span>
                <div className="text-2xl font-black text-white">{stats?.total_departments || departments.length || 10}</div>
                <div className="text-[11px] text-emerald-400">Engineering & Sciences</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Subjects Created</span>
                <div className="text-2xl font-black text-white">{stats?.total_subjects || subjects.length || 0}</div>
                <div className="text-[11px] text-amber-400">Manually Admin Added</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Examinations</span>
                <div className="text-2xl font-black text-white">{stats?.total_exams || exams.length || 0}</div>
                <div className="text-[11px] text-purple-400">Configured Assessments</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Question Bank</span>
                <div className="text-2xl font-black text-white">{stats?.total_questions || questions.length || 50}</div>
                <div className="text-[11px] text-sky-400">Active MCQs</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Total Attempts</span>
                <div className="text-2xl font-black text-white">{stats?.total_attempts || 0}</div>
                <div className="text-[11px] text-teal-400">Student Submissions</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Average Score</span>
                <div className="text-2xl font-black text-white">{stats?.average_score || 0}</div>
                <div className="text-[11px] text-indigo-400">Marks per Attempt</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Average Percentage</span>
                <div className="text-2xl font-black text-white">{stats?.average_percentage || 0}%</div>
                <div className="text-[11px] text-emerald-400">Overall Accuracy</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white">System Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => { setActiveTab('subjects'); setShowAddSubjectModal(true); }}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-sky-500 rounded-xl text-left transition-all group"
                >
                  <BookOpen className="w-5 h-5 text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-white">+ Add Subject</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Create curriculum subject</div>
                </button>
                <button
                  onClick={() => { setActiveTab('students'); setShowBulkImportModal(true); }}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl text-left transition-all group"
                >
                  <UploadCloud className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-white">Bulk Import Students</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Upload CSV, XLSX, or PDF</div>
                </button>
                <button
                  onClick={() => { setActiveTab('exams'); setShowCreateExamModal(true); }}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-purple-500 rounded-xl text-left transition-all group"
                >
                  <Calendar className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-white">+ Create Exam</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Configure new test</div>
                </button>
                <button
                  onClick={() => { setActiveTab('questions'); setShowAddQuestionModal(true); }}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500 rounded-xl text-left transition-all group"
                >
                  <HelpCircle className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-white">+ Add MCQ</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Add to question bank</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. ACADEMIC STRUCTURE TAB */}
        {activeTab === 'academic' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Institutional Departments</h3>
                <p className="text-xs text-slate-400">Database-backed academic departments</p>
              </div>
              <button
                onClick={() => setShowAddDeptModal(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Department</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((d) => (
                <div key={d.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-slate-950 border border-slate-800 text-sky-400 rounded-xl">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{d.name}</h4>
                      <span className="text-[11px] text-slate-500 font-mono font-medium">Code: {d.code || 'N/A'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleDeptStatus(d)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                      d.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {d.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
            </div>

            {/* Academic Structure Tree */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white">Academic Program Hierarchy</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* UG Programs */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center space-x-2 text-sky-400 font-bold text-sm">
                    <GraduationCap className="w-4 h-4" />
                    <span>Undergraduate (UG / B.Tech)</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {academicYears.filter(y => y.program_id === 1 || (y.name.includes('Year') && !y.name.includes('M.Tech'))).map(yr => (
                      <div key={yr.id} className="pl-3 border-l-2 border-slate-800 py-1 space-y-1">
                        <span className="text-slate-200 font-bold block">{yr.name}</span>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {semesters.filter(s => s.academic_year_id === yr.id).map(sem => (
                            <span key={sem.id} className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded">
                              {sem.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* M.Tech Programs */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                    <GraduationCap className="w-4 h-4" />
                    <span>Postgraduate (M.Tech)</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {academicYears.filter(y => y.name.includes('M.Tech')).map(yr => (
                      <div key={yr.id} className="pl-3 border-l-2 border-slate-800 py-1 space-y-1">
                        <span className="text-slate-200 font-bold block">{yr.name}</span>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {semesters.filter(s => s.academic_year_id === yr.id).map(sem => (
                            <span key={sem.id} className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded">
                              {sem.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. STUDENT MANAGEMENT TAB */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Student Directory & Credentials</h3>
                <p className="text-xs text-slate-400">Manage enrolled students, unique roll numbers, and login status</p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowBulkImportModal(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Bulk Import (CSV / XLSX / PDF)</span>
                </button>
                <button
                  onClick={() => {
                    setEditingStudent(null);
                    setStFormEnrollment('');
                    setStFormName('');
                    setShowAddStudentModal(true);
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add Student</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by Roll No or Name..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={studentDeptFilter}
                onChange={(e) => setStudentDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Students Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Roll / Enrollment No</th>
                      <th className="py-3.5 px-4">Student Name</th>
                      <th className="py-3.5 px-4">Gender</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Year / Sem</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {studentsList
                      .filter((st) => {
                        const matchSearch = !studentSearch || st.enrollment_no.toLowerCase().includes(studentSearch.toLowerCase()) || st.name.toLowerCase().includes(studentSearch.toLowerCase());
                        const matchDept = !studentDeptFilter || st.department === studentDeptFilter;
                        return matchSearch && matchDept;
                      })
                      .map((st) => (
                        <tr key={st.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-sky-400">{st.enrollment_no}</td>
                          <td className="py-3.5 px-4 font-medium text-white">{st.name}</td>
                          <td className="py-3.5 px-4 text-slate-400">{st.gender || '-'}</td>
                          <td className="py-3.5 px-4 text-slate-300">{st.department}</td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {st.year || '1st Year'} • {st.semester || 'Sem 1'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              st.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {st.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingStudent(st);
                                setStFormEnrollment(st.enrollment_no);
                                setStFormName(st.name);
                                setStFormGender(st.gender || 'Male');
                                setStFormDept(st.department);
                                setStFormProg(st.program || 'UG');
                                setStFormYear(st.year || '1st Year');
                                setStFormSem(st.semester || 'Semester 1');
                                setStFormPassword('');
                                setShowAddStudentModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStudentStatus(st)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                st.is_active
                                  ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                                  : 'text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={st.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. SUBJECT MANAGEMENT TAB */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-sky-400" />
                  <span>Subject Management</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Subjects are created manually by the administrator and mapped to departments and semesters.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectFormName('');
                  setSubjectFormCode('');
                  if (departments.length > 0) setSubjectFormDeptId(departments[0].id);
                  setShowAddSubjectModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-sky-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Subject</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search subject by name or code..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={subjectDeptFilter}
                onChange={(e) => setSubjectDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id.toString()}>{d.name}</option>
                ))}
              </select>

              <select
                value={subjectStatusFilter}
                onChange={(e) => setSubjectStatusFilter(e.target.value as any)}
                className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Subjects Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Subject Name</th>
                      <th className="py-3.5 px-4">Code</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Program</th>
                      <th className="py-3.5 px-4">Academic Year</th>
                      <th className="py-3.5 px-4">Semester</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {subjects
                      .filter((s) => {
                        const matchSearch = !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase()) || s.code.toLowerCase().includes(subjectSearch.toLowerCase());
                        const matchDept = !subjectDeptFilter || s.department_id.toString() === subjectDeptFilter;
                        const matchStatus = subjectStatusFilter === 'all' || (subjectStatusFilter === 'active' ? s.is_active : !s.is_active);
                        return matchSearch && matchDept && matchStatus;
                      })
                      .map((subj) => (
                        <tr key={subj.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">{subj.name}</td>
                          <td className="py-3.5 px-4 font-mono text-sky-400 font-semibold">{subj.code}</td>
                          <td className="py-3.5 px-4 text-slate-300">{subj.department_name || 'N/A'}</td>
                          <td className="py-3.5 px-4 text-slate-400">{subj.program_name || 'UG'}</td>
                          <td className="py-3.5 px-4 text-slate-400">{subj.year_name || '2nd Year'}</td>
                          <td className="py-3.5 px-4 text-slate-400">{subj.semester_name || 'Sem 3'}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              subj.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {subj.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => {
                                setEditingSubject(subj);
                                setSubjectFormName(subj.name);
                                setSubjectFormCode(subj.code);
                                setSubjectFormDeptId(subj.department_id);
                                setSubjectFormProgId(subj.program_id);
                                setSubjectFormYearId(subj.academic_year_id);
                                setSubjectFormSemId(subj.semester_id);
                                setShowAddSubjectModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleSubjectStatus(subj)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                subj.is_active
                                  ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                                  : 'text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={subj.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingSubject(subj)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Delete (Safe Check)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. QUESTION BANK TAB */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-sky-400" />
                  <span>Subject-Specific Question Bank</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Create and manage question pools categorized by Subject, Department, Difficulty, and Marks.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setQFormText('');
                  setQFormOptA('');
                  setQFormOptB('');
                  setQFormOptC('');
                  setQFormOptD('');
                  setShowAddQuestionModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-sky-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Question</span>
              </button>
            </div>

            {/* Filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search questions by text..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={questionSubjectFilter}
                onChange={(e) => setQuestionSubjectFilter(e.target.value)}
                className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id.toString()}>{s.name} ({s.code})</option>
                ))}
              </select>

              <select
                value={questionDeptFilter}
                onChange={(e) => setQuestionDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id.toString()}>{d.name}</option>
                ))}
              </select>

              <select
                value={questionStatusFilter}
                onChange={(e) => setQuestionStatusFilter(e.target.value as any)}
                className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Questions Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-12">#</th>
                      <th className="py-3.5 px-4">Question Text</th>
                      <th className="py-3.5 px-4">Subject</th>
                      <th className="py-3.5 px-4">Answer</th>
                      <th className="py-3.5 px-4">Difficulty</th>
                      <th className="py-3.5 px-4">Marks</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {questions
                      .filter((q) => {
                        const matchSearch = !questionSearch || q.question_text.toLowerCase().includes(questionSearch.toLowerCase());
                        const matchSubj = !questionSubjectFilter || q.subject_id?.toString() === questionSubjectFilter;
                        const matchDept = !questionDeptFilter || q.department_id?.toString() === questionDeptFilter;
                        const matchStatus = questionStatusFilter === 'all' || (questionStatusFilter === 'active' ? q.is_active : !q.is_active);
                        return matchSearch && matchSubj && matchDept && matchStatus;
                      })
                      .map((q) => (
                        <tr key={q.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-500 font-bold">{q.id}</td>
                          <td className="py-3.5 px-4 font-medium text-white max-w-md truncate">
                            {q.question_text}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">{q.subject_name || q.topic || 'General DSA'}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">{q.correct_answer}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 font-medium">
                              {q.difficulty || 'Medium'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 font-bold">{q.marks || 1}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              q.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {q.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => {
                                setEditingQuestion(q);
                                setQFormText(q.question_text);
                                setQFormOptA(q.option_a);
                                setQFormOptB(q.option_b);
                                setQFormOptC(q.option_c);
                                setQFormOptD(q.option_d);
                                setQFormCorrect(q.correct_answer);
                                setQFormTopic(q.topic || 'General');
                                setQFormDifficulty(q.difficulty || 'Medium');
                                setQFormMarks(q.marks || 1);
                                setQFormSubjectId(q.subject_id || undefined);
                                setQFormDeptId(q.department_id || undefined);
                                setShowAddQuestionModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleQuestionStatus(q)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                q.is_active
                                  ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                                  : 'text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={q.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingQuestion(q)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Delete (Safe Check)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 6. EXAM MANAGEMENT TAB */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <span>Examination Management & Student Assignment</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Configure department-specific examinations and grant student-specific access authorization.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingExam(null);
                  setExamFormTitle('');
                  setExamFormCode('');
                  if (subjects.length > 0) setExamFormSubjectId(subjects[0].id);
                  if (departments.length > 0) setExamFormDeptId(departments[0].id);
                  setShowCreateExamModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-purple-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Examination</span>
              </button>
            </div>

            {/* Exam Filters */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search examinations..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={examStatusFilter}
                onChange={(e) => setExamStatusFilter(e.target.value)}
                className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Exams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {exams
                .filter(ex => (!examSearch || ex.title.toLowerCase().includes(examSearch.toLowerCase())) && (!examStatusFilter || ex.status === examStatusFilter))
                .map((ex) => (
                  <div key={ex.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          ex.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : ex.status === 'draft'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {ex.status}
                        </span>
                        {ex.code && <span className="font-mono text-xs font-bold text-slate-500">{ex.code}</span>}
                      </div>

                      <h4 className="text-base font-bold text-white">{ex.title}</h4>
                      <p className="text-xs text-slate-400">
                        Subject: <span className="text-slate-200 font-medium">{ex.subject_name || 'General'}</span>
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                        <div>Duration: <span className="text-white font-semibold">{ex.duration_minutes} Mins</span></div>
                        <div>Questions: <span className="text-white font-semibold">{ex.total_questions}</span></div>
                        <div>Total Marks: <span className="text-white font-semibold">{ex.total_marks}</span></div>
                        <div>Passing: <span className="text-white font-semibold">{ex.passing_percentage}%</span></div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Assigned Students:</span>
                        <span className="font-bold text-sky-400">{ex.assigned_students_count} Students</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => openAssignModal(ex)}
                        className="flex-1 py-2 px-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assign Students</span>
                      </button>

                      {ex.status === 'published' ? (
                        <button
                          onClick={() => handleToggleExamStatus(ex, 'closed')}
                          className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                          title="Close Exam"
                        >
                          Close
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleExamStatus(ex, 'published')}
                          className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
                          title="Publish Exam"
                        >
                          Publish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 7. STUDENT ASSESSMENT RECORDS TAB */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <span>Student Assessment Records & Audit</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Inspect candidate answers, anti-cheating audit trail, scores, and permanent attempt management.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search assessment records by student or roll no..."
                  value={recordsSearch}
                  onChange={(e) => setRecordsSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={recordsDeptFilter}
                onChange={(e) => setRecordsDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Records Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Roll No</th>
                      <th className="py-3.5 px-4">Student Name</th>
                      <th className="py-3.5 px-4">Exam / Subject</th>
                      <th className="py-3.5 px-4">Score</th>
                      <th className="py-3.5 px-4">Percentage</th>
                      <th className="py-3.5 px-4">Security Flags</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {studentRecords
                      .filter((r) => {
                        const matchSearch = !recordsSearch || r.enrollment_no.toLowerCase().includes(recordsSearch.toLowerCase()) || r.name.toLowerCase().includes(recordsSearch.toLowerCase());
                        const matchDept = !recordsDeptFilter || r.department === recordsDeptFilter;
                        return matchSearch && matchDept;
                      })
                      .map((rec) => (
                        <tr key={rec.student_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-sky-400">{rec.enrollment_no}</td>
                          <td className="py-3.5 px-4 font-medium text-white">{rec.name}</td>
                          <td className="py-3.5 px-4 text-slate-300">{rec.exam_title || 'General Assessment'}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-400">
                            {rec.score !== null ? rec.score : '-'}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-300">
                            {rec.percentage !== null ? `${rec.percentage}%` : '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            {rec.tab_switch_count || rec.fullscreen_exit_count ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                                <ShieldAlert className="w-3 h-3" />
                                <span>{rec.tab_switch_count || 0} Tabs / {rec.fullscreen_exit_count || 0} FS</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Clean</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              rec.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : rec.status === 'timed_out'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            {rec.attempt_id && (
                              <>
                                <button
                                  onClick={() => handleInspectAttempt(rec)}
                                  className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors"
                                  title="Inspect Attempt & Answers"
                                >
                                  {inspectLoading ? <span className="text-[10px]">...</span> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => setDeletingAttempt(rec)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                  title="Delete Assessment Attempt"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 8. SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
            <div>
              <h3 className="text-lg font-bold text-white">Assessment Configuration Settings</h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure global defaults for time limits and question count per attempt.
              </p>
            </div>

            {settingsData && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs">
                <div>Active Question Pool: <span className="text-emerald-400 font-bold">{settingsData.active_questions_count}</span></div>
                <div>Total Question Bank: <span className="text-sky-400 font-bold">{settingsData.total_questions_count}</span></div>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Default Question Count
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={settingsQuestionCount}
                  onChange={(e) => setSettingsQuestionCount(parseInt(e.target.value, 10))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Default Time Limit (Minutes)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={settingsTimeLimit}
                  onChange={(e) => setSettingsTimeLimit(parseInt(e.target.value, 10))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={settingsSaving}
                className="py-3 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
              >
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        )}

        {/* 9. EXPORTS TAB */}
        {activeTab === 'exports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 w-12 h-12 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Excel Assessment Report (.xlsx)</h4>
              <p className="text-xs text-slate-400">
                Exports all candidate records, scores, subject mappings, attempt dates, and anti-cheating event counters.
              </p>
              <button
                onClick={handleExportExcel}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Excel Report</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="p-3 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20 w-12 h-12 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">CSV Assessment Report (.csv)</h4>
              <p className="text-xs text-slate-400">
                Standard comma-separated format compatible with institutional LMS and spreadsheet processing tools.
              </p>
              <button
                onClick={handleExportCSV}
                className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV Report</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ADD / EDIT SUBJECT */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                <span>{editingSubject ? 'Edit Subject' : '+ Add Subject (Manual)'}</span>
              </h4>
              <button onClick={() => setShowAddSubjectModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures"
                  value={subjectFormName}
                  onChange={(e) => setSubjectFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Subject Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS301"
                  value={subjectFormCode}
                  onChange={(e) => setSubjectFormCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Department *</label>
                <select
                  required
                  value={subjectFormDeptId}
                  onChange={(e) => setSubjectFormDeptId(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value={0}>Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Program</label>
                  <select
                    value={subjectFormProgId || ''}
                    onChange={(e) => setSubjectFormProgId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px]"
                  >
                    <option value="">Default (UG)</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Year</label>
                  <select
                    value={subjectFormYearId || ''}
                    onChange={(e) => setSubjectFormYearId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px]"
                  >
                    <option value="">Select Year...</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Semester</label>
                  <select
                    value={subjectFormSemId || ''}
                    onChange={(e) => setSubjectFormSemId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px]"
                  >
                    <option value="">Select Sem...</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold"
                >
                  {editingSubject ? 'Update Subject' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK IMPORT STUDENTS */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center space-x-2">
                <UploadCloud className="w-5 h-5 text-emerald-400" />
                <span>Bulk Student Import</span>
              </h4>
              <button onClick={() => setShowBulkImportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkImportStudents} className="space-y-4 text-xs">
              <p className="text-slate-400">
                Select academic parameters and upload a student roll-list file (<span className="text-white font-semibold">CSV, Excel XLSX, or PDF</span>).
              </p>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Target Department *</label>
                <select
                  required
                  value={importDept}
                  onChange={(e) => setImportDept(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Program</label>
                  <select
                    value={importProg}
                    onChange={(e) => setImportProg(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px]"
                  >
                    <option value="UG">UG</option>
                    <option value="M.Tech">M.Tech</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Year</label>
                  <select
                    value={importYear}
                    onChange={(e) => setImportYear(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px]"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="Final Year">Final Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Semester</label>
                  <select
                    value={importSem}
                    onChange={(e) => setImportSem(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px]"
                  >
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                    <option value="Semester 3">Semester 3</option>
                    <option value="Semester 4">Semester 4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Upload File (CSV, XLSX, or PDF) *</label>
                <input
                  type="file"
                  required
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/10 file:text-sky-400 hover:file:bg-sky-500/20"
                />
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {importLoading ? 'Processing File...' : 'Import Students'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT STUDENT */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-sky-400" />
                <span>{editingStudent ? 'Edit Student' : '+ Add Enrolled Student'}</span>
              </h4>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Roll / Enrollment No *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BT26F05F001"
                  value={stFormEnrollment}
                  onChange={(e) => setStFormEnrollment(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Mercer"
                  value={stFormName}
                  onChange={(e) => setStFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Gender</label>
                  <select
                    value={stFormGender}
                    onChange={(e) => setStFormGender(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Department</label>
                  <select
                    value={stFormDept}
                    onChange={(e) => setStFormDept(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Password or Secure PIN</label>
                <input
                  type="password"
                  placeholder="Leave blank for default (Roll Number)"
                  value={stFormPassword}
                  onChange={(e) => setStFormPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold"
                >
                  {editingStudent ? 'Save Changes' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN STUDENTS TO EXAM */}
      {assigningExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-sky-400" />
                  <span>Assign Students to: {assigningExam.title}</span>
                </h4>
                <p className="text-xs text-slate-400">
                  CRITICAL: Only selected students will have authorization to see and take this exam.
                </p>
              </div>
              <button onClick={() => setAssigningExam(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Select All */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter students by roll or name..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <select
                value={assignFilterDept}
                onChange={(e) => setAssignFilterDept(e.target.value)}
                className="py-1.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const filtered = studentsList
                      .filter(st => (!assignSearch || st.enrollment_no.toLowerCase().includes(assignSearch.toLowerCase()) || st.name.toLowerCase().includes(assignSearch.toLowerCase())) && (!assignFilterDept || st.department === assignFilterDept))
                      .map(st => st.id);
                    setSelectedStudentIdsToAssign(Array.from(new Set([...selectedStudentIdsToAssign, ...filtered])));
                  }}
                  className="px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg font-bold"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIdsToAssign([])}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg font-semibold"
                >
                  Clear All
                </button>
                <span className="text-slate-400 font-bold ml-2">
                  {selectedStudentIdsToAssign.length} Selected (Previously Assigned: {assignedStudents.length})
                </span>
              </div>
            </div>

            {/* Students Selection List */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl p-2 space-y-1 bg-slate-950/60 max-h-[350px]">
              {studentsList
                .filter(st => (!assignSearch || st.enrollment_no.toLowerCase().includes(assignSearch.toLowerCase()) || st.name.toLowerCase().includes(assignSearch.toLowerCase())) && (!assignFilterDept || st.department === assignFilterDept))
                .map((st) => {
                  const isChecked = selectedStudentIdsToAssign.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors text-xs ${
                        isChecked ? 'bg-sky-500/10 border border-sky-500/30' : 'hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIdsToAssign([...selectedStudentIdsToAssign, st.id]);
                            } else {
                              setSelectedStudentIdsToAssign(selectedStudentIdsToAssign.filter(id => id !== st.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-0"
                        />
                        <div>
                          <span className="font-mono font-bold text-sky-400 block">{st.enrollment_no}</span>
                          <span className="font-medium text-white">{st.name}</span>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-400">
                        <span>{st.department}</span>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                Only selected students will be eligible to see and start this exam.
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setAssigningExam(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveStudentAssignments}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold"
                >
                  Save Exam Assignments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT EXAM */}
      {showCreateExamModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                <span>{editingExam ? 'Edit Examination' : '+ Create New Examination'}</span>
              </h4>
              <button onClick={() => setShowCreateExamModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Exam Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures Midterm Test"
                  value={examFormTitle}
                  onChange={(e) => setExamFormTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Subject</label>
                  <select
                    value={examFormSubjectId || ''}
                    onChange={(e) => setExamFormSubjectId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="">Select Subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Department</label>
                  <select
                    value={examFormDeptId || ''}
                    onChange={(e) => setExamFormDeptId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormDuration}
                    onChange={(e) => setExamFormDuration(parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Questions</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormQuestionsCount}
                    onChange={(e) => setExamFormQuestionsCount(parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Marks/Q</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormMarksPerQ}
                    onChange={(e) => setExamFormMarksPerQ(parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Pass %</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={examFormPassingPct}
                    onChange={(e) => setExamFormPassingPct(parseFloat(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Start Date (Optional)</label>
                  <input
                    type="date"
                    value={examFormStartDate}
                    onChange={(e) => setExamFormStartDate(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={examFormEndDate}
                    onChange={(e) => setExamFormEndDate(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Selection Mode</label>
                  <select
                    value={examFormSelectionMode}
                    onChange={(e) => setExamFormSelectionMode(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="random">Random from Subject Bank</option>
                    <option value="manual">Manual Selection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Initial Status</label>
                  <select
                    value={examFormStatus}
                    onChange={(e) => setExamFormStatus(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="published">Published (Available)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold"
                >
                  {editingExam ? 'Save Changes' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT QUESTION */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-sky-400" />
                <span>{editingQuestion ? 'Edit Question' : '+ Add Question to Question Bank'}</span>
              </h4>
              <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Subject Association</label>
                <select
                  value={qFormSubjectId || ''}
                  onChange={(e) => setQFormSubjectId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value="">General / None</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Question Statement *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter MCQ statement..."
                  value={qFormText}
                  onChange={(e) => setQFormText(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Option A *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptA}
                    onChange={(e) => setQFormOptA(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Option B *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptB}
                    onChange={(e) => setQFormOptB(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Option C *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptC}
                    onChange={(e) => setQFormOptC(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Option D *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptD}
                    onChange={(e) => setQFormOptD(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Correct Answer *</label>
                  <select
                    value={qFormCorrect}
                    onChange={(e) => setQFormCorrect(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Difficulty</label>
                  <select
                    value={qFormDifficulty}
                    onChange={(e) => setQFormDifficulty(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={qFormMarks}
                    onChange={(e) => setQFormMarks(parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold"
                >
                  {editingQuestion ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE ATTEMPT CONFIRMATION */}
      {deletingAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Delete Assessment Attempt?</h4>
                <p className="text-xs text-slate-400">Attempt #{deletingAttempt.attempt_id}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete the attempt of student <span className="font-bold text-white">{deletingAttempt.name}</span> ({deletingAttempt.enrollment_no})?
              All question answers and security audit logs for this attempt will be removed. The student account and questions will be preserved.
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAttempt(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAttempt}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20"
              >
                Yes, Delete Attempt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE SUBJECT CONFIRMATION */}
      {deletingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Delete Subject?</h4>
                <p className="text-xs text-slate-400">{deletingSubject.name} ({deletingSubject.code})</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If this subject has associated questions or examinations, hard deletion will be blocked to preserve historical examination integrity.
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSubject(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE QUESTION CONFIRMATION */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Delete Question #{deletingQuestion.id}?</h4>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If this question has been answered in past student attempts, deletion is blocked and deactivation is recommended.
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingQuestion(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteQuestion}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT ATTEMPT DETAILS */}
      {inspectingAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-base font-bold text-white">
                  Assessment Details: {inspectingAttempt.student.name} ({inspectingAttempt.student.enrollment_no})
                </h4>
                <p className="text-xs text-slate-400">
                  Attempt #{inspectingAttempt.attempt.id} • Score: {inspectingAttempt.attempt.score} ({inspectingAttempt.attempt.percentage}%) • Status: {inspectingAttempt.attempt.status}
                </p>
              </div>
              <button onClick={() => setInspectingAttempt(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Anti-cheating logs summary */}
            {inspectingAttempt.security_logs && inspectingAttempt.security_logs.length > 0 && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 space-y-1">
                <span className="font-bold flex items-center space-x-1">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Anti-Cheating Security Audit Trail ({inspectingAttempt.security_logs.length} Recorded Events)</span>
                </span>
                <div className="max-h-24 overflow-y-auto space-y-1 pt-1 text-[11px]">
                  {inspectingAttempt.security_logs.map((log: any) => (
                    <div key={log.id} className="flex justify-between text-slate-300">
                      <span>• [{log.event_type}] {log.details || 'Detected event'}</span>
                      <span className="text-slate-500 font-mono">{new Date(log.occurred_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Answers List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {inspectingAttempt.answers.map((ans: any) => (
                <div key={ans.question_number} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-white">Q{ans.question_number}. {ans.question}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ans.is_correct
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {ans.is_correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>Student Choice: <span className="font-bold text-white">{ans.selected_answer || 'Skipped'}</span></div>
                    <div>Correct Answer: <span className="font-bold text-emerald-400">{ans.correct_answer}</span></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setInspectingAttempt(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD DEPARTMENT */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center space-x-2">
                <Building className="w-5 h-5 text-sky-400" />
                <span>+ Add Department</span>
              </h4>
              <button onClick={() => setShowAddDeptModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDepartment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Department Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biomedical Engineering"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Department Code</label>
                <input
                  type="text"
                  placeholder="e.g. BIOMED"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminDashboard;
