import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users, CheckCircle2, LogOut, Download, FileText,
  UserCheck, Search, Eye, HelpCircle, Sliders, Plus, Edit3, Power,
  AlertTriangle, X, Shield, RefreshCw, Trash2, BookOpen,
  GraduationCap, Building, Layers, Calendar, UserPlus,
  UploadCloud, FileSpreadsheet, ShieldAlert, Lock, ArrowRight, ArrowLeft,
  Archive, ArchiveRestore
} from 'lucide-react';
import api from '../services/api';
import { CollegeBranding } from '../components/CollegeBranding';
import type {
  AdminStats, StudentSummary, AdminQuestion, AssessmentSettings,
  Department, Program, AcademicYear, Semester, Subject, Exam, AssignedStudent, Student,
  DepartmentStats, AdminUser
} from '../types';

type DashboardTab = 'overview' | 'academic' | 'students' | 'subjects' | 'questions' | 'exams' | 'records' | 'settings' | 'exports';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Active Tab
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    const tab = location.pathname.split('/')[2];
    return ['academic', 'students', 'subjects', 'questions', 'exams', 'settings'].includes(tab) ? tab as DashboardTab : 'overview';
  });

  // Stats & Loading
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  // User Profile & RBAC
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const cached = localStorage.getItem('admin_user');
    return cached ? JSON.parse(cached) : null;
  });

  // Department Stats State (GET /api/departments/stats)
  const [deptStats, setDeptStats] = useState<DepartmentStats[]>([]);
  const [selectedDeptWorkspace, setSelectedDeptWorkspace] = useState<DepartmentStats | null>(null);

  // Global Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showNotice = (type: 'success' | 'error', message: unknown) => {
    const text = typeof message === 'string' ? message : Array.isArray(message)
      ? message.map(item => typeof item?.msg === 'string' ? item.msg : 'Invalid form value').join('. ')
      : 'The request could not be completed. Please retry.';
    setNotification({ type, message: text });
    setTimeout(() => setNotification(null), 5000);
  };

  // Academic Structure State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);

  // Department Modal State - REMOVED Department Code completely per user requirement
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [deptCreating, setDeptCreating] = useState(false);

  // Subject Management State (MANUALLY ADDED ONLY)
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectDeptFilter, setSubjectDeptFilter] = useState<string>('');
  const [subjectStatusFilter, setSubjectStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [subjectDeps, setSubjectDeps] = useState<{
    loading: boolean;
    has_dependencies: boolean;
    can_delete: boolean;
    question_count: number;
    exam_count: number;
    attempt_count: number;
    answers_count?: number;
    dependency_summary?: string;
    reason?: string;
  } | null>(null);
  const [isDeletingSubject, setIsDeletingSubject] = useState(false);
  const [isDeactivatingSubject, setIsDeactivatingSubject] = useState(false);
  const [subjectFormName, setSubjectFormName] = useState('');
  const [subjectFormCode, setSubjectFormCode] = useState('');
  const [subjectFormDeptId, setSubjectFormDeptId] = useState<number | ''>('');
  const [subjectFormProgId, setSubjectFormProgId] = useState<number | ''>('');
  const [subjectFormYearId, setSubjectFormYearId] = useState<number | ''>('');
  const [subjectFormSemId, setSubjectFormSemId] = useState<number | ''>('');

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

  // Student Selection & Safe Deletion State
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleteConfirmedBackup, setDeleteConfirmedBackup] = useState(false);
  const [deletingStudents, setDeletingStudents] = useState(false);
  const [showExportOptionsModal, setShowExportOptionsModal] = useState(false);


  // Student Form State
  const [stFormEnrollment, setStFormEnrollment] = useState('');
  const [stFormName, setStFormName] = useState('');
  const [stFormGender, setStFormGender] = useState('Male');
  const [stFormDept, setStFormDept] = useState('');
  const [stFormProg, setStFormProg] = useState('UG');
  const [stFormYear, setStFormYear] = useState('1st Year');
  const [stFormSem, setStFormSem] = useState('Semester 1');
  const [stFormPassword, setStFormPassword] = useState('');

  // Question Management State
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState('');
  const [questionDeptFilter, setQuestionDeptFilter] = useState('');
  const [questionStatusFilter, setQuestionStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<AdminQuestion | null>(null);

  // Question Form State
  const [qFormText, setQFormText] = useState('');
  const [qFormOptA, setQFormOptA] = useState('');
  const [qFormOptB, setQFormOptB] = useState('');
  const [qFormOptC, setQFormOptC] = useState('');
  const [qFormOptD, setQFormOptD] = useState('');
  const [qFormCorrect, setQFormCorrect] = useState('A');
  const [qFormTopic, setQFormTopic] = useState('Data Structures');
  const [qFormDifficulty, setQFormDifficulty] = useState('Medium');
  const [qFormMarks, setQFormMarks] = useState<number>(1);
  const [qFormSubjectId, setQFormSubjectId] = useState<number | ''>('');
  const [qFormDeptId, setQFormDeptId] = useState<number | ''>('');
  const [showQuestionImportModal, setShowQuestionImportModal] = useState(false);
  const [questionImportFile, setQuestionImportFile] = useState<File | null>(null);
  const [questionImportSubjectId, setQuestionImportSubjectId] = useState<number | ''>('');
  const [questionImportPreview, setQuestionImportPreview] = useState<any | null>(null);
  const [questionImportLoading, setQuestionImportLoading] = useState(false);

  // Exam Management State
  const [exams, setExams] = useState<Exam[]>([]);
  const [examSearch, setExamSearch] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState('');
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [examSaving, setExamSaving] = useState(false);
  const [examSelectedQuestionIds, setExamSelectedQuestionIds] = useState<number[]>([]);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [assigningExam, setAssigningExam] = useState<Exam | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<AssignedStudent[]>([]);
  const [selectedStudentIdsToAssign, setSelectedStudentIdsToAssign] = useState<number[]>([]);
  const [assignFilterDept, setAssignFilterDept] = useState('');
  const [assignSearch, setAssignSearch] = useState('');

  // Exam Safe Delete & Archive State
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [showExamDeleteModal, setShowExamDeleteModal] = useState(false);
  const [examDeleteLoading, setExamDeleteLoading] = useState(false);
  const [examToArchive, setExamToArchive] = useState<Exam | null>(null);
  const [showExamArchiveModal, setShowExamArchiveModal] = useState(false);
  const [examArchiveLoading, setExamArchiveLoading] = useState(false);
  const [sessionCodeDisplay, setSessionCodeDisplay] = useState<{ examTitle: string; code: string } | null>(null);

  // Exam Form State
  const [examFormTitle, setExamFormTitle] = useState('');
  const [examFormCode, setExamFormCode] = useState('');
  const [examFormDeptId, setExamFormDeptId] = useState<number | ''>('');
  const [examFormProgId, setExamFormProgId] = useState<number | ''>('');
  const [examFormYearId, setExamFormYearId] = useState<number | ''>('');
  const [examFormSemId, setExamFormSemId] = useState<number | ''>('');
  const [examFormSubjectId, setExamFormSubjectId] = useState<number | ''>('');
  const [examFormDuration, setExamFormDuration] = useState<number>(60);
  const [examFormQuestionsCount, setExamFormQuestionsCount] = useState<number>(25);
  const [examFormMarksPerQ, setExamFormMarksPerQ] = useState<number>(1);
  const [examFormPassingPct, setExamFormPassingPct] = useState<number>(40);
  const [examFormSelectionMode, setExamFormSelectionMode] = useState<'random' | 'manual'>('random');
  const [examFormStatus, setExamFormStatus] = useState<string>('published');
  const [examFormStartDate, setExamFormStartDate] = useState('');
  const [examFormStartTime, setExamFormStartTime] = useState('');
  const [examFormEndDate, setExamFormEndDate] = useState('');
  const [examFormEndTime, setExamFormEndTime] = useState('');
  const [examFormResultRelease, setExamFormResultRelease] = useState<'immediate' | 'after_close'>('after_close');

  // Student Assessment Records State
  const [studentRecords, setStudentRecords] = useState<StudentSummary[]>([]);
  const [recordsSearch, setRecordsSearch] = useState('');
  const [recordsDeptFilter, setRecordsDeptFilter] = useState('');
  const [deletingAttempt, setDeletingAttempt] = useState<StudentSummary | null>(null);
  const [attemptDeps, setAttemptDeps] = useState<any | null>(null);
  const [checkingAttemptDeps, setCheckingAttemptDeps] = useState(false);
  const [isDeletingAttempt, setIsDeletingAttempt] = useState(false);
  const [inspectingAttempt, setInspectingAttempt] = useState<any | null>(null);

  // Multi-Selection State for All Modules
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<number[]>([]);
  const [selectedRecordAttemptIds, setSelectedRecordAttemptIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Question Dependency & Safe Deletion State
  const [questionDeps, setQuestionDeps] = useState<any | null>(null);
  const [checkingQuestionDeps, setCheckingQuestionDeps] = useState(false);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);

  // Department Safe Deletion State
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deptDeps, setDeptDeps] = useState<any | null>(null);
  const [checkingDeptDeps, setCheckingDeptDeps] = useState(false);
  const [isDeletingDept, setIsDeletingDept] = useState(false);

  // Admin User Accounts & Verified Backups State
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [systemBackups, setSystemBackups] = useState<any[]>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [verifyingBackupFilename, setVerifyingBackupFilename] = useState<string | null>(null);
  const [verifiedBackupResult, setVerifiedBackupResult] = useState<any | null>(null);

  // High-Impact Bulk Delete Confirmation State (Requirement 3 & 4)
  const [bulkDeleteConfig, setBulkDeleteConfig] = useState<{
    type: 'subjects' | 'questions' | 'exams' | 'attempts' | 'users' | null;
    ids: number[];
    title: string;
    description: string;
    itemCount: number;
    impactDetails?: string;
  } | null>(null);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Assessment Settings State
  const [settingsQuestionCount, setSettingsQuestionCount] = useState<number>(50);
  const [settingsTimeLimit, setSettingsTimeLimit] = useState<number>(60);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ==========================================
  // INITIALIZATION & DATA FETCHING
  // ==========================================

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [statsRes, structureRes, deptsRes, subjectsRes, deptStatsRes, meRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/academic-structure'),
        api.get('/departments'),
        api.get('/subjects'),
        api.get('/departments/stats'),
        api.get('/auth/me')
      ]);
      setStats(statsRes.data);
      const loadedDepts = deptsRes.data.length > 0 ? deptsRes.data : (structureRes.data.departments || []);
      setDepartments(loadedDepts);
      setPrograms(structureRes.data.programs || []);
      setAcademicYears(structureRes.data.years || []);
      setSemesters(structureRes.data.semesters || []);
      setSubjects(subjectsRes.data || []);
      
      const statsList: DepartmentStats[] = deptStatsRes.data || [];
      setDeptStats(statsList);

      const user: AdminUser = meRes.data;
      setCurrentUser(user);
      localStorage.setItem('admin_user', JSON.stringify(user));

      if (user.role === 'hod' && user.department_id) {
        // HOD landing directly on their department dashboard workspace
        const myDept = statsList.find((d: DepartmentStats) => d.id === user.department_id);
        if (myDept) {
          setSelectedDeptWorkspace(myDept);
        }
        setSubjectDeptFilter(String(user.department_id));
        setQuestionDeptFilter(String(user.department_id));
        if (user.department_name) {
          setStudentDeptFilter(user.department_name);
          setImportDept(user.department_name);
          setStFormDept(user.department_name);
          setRecordsDeptFilter(user.department_name);
        }
        if (location.pathname === '/admin/dashboard') setActiveTab('subjects');
      } else if (loadedDepts.length > 0) {
        setImportDept(loadedDepts[0].name);
        setStFormDept(loadedDepts[0].name);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        sessionStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin/login');
      } else {
        console.error('Error loading dashboard:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAcademicData = async () => {
    try {
      const [structRes, deptsRes] = await Promise.all([
        api.get('/academic-structure'),
        api.get('/departments')
      ]);
      const depts = deptsRes.data.length > 0 ? deptsRes.data : (structRes.data.departments || []);
      setDepartments(depts);
      setPrograms(structRes.data.programs || []);
      setAcademicYears(structRes.data.years || []);
      setSemesters(structRes.data.semesters || []);
      return depts;
    } catch (err) {
      console.error('Failed to load academic data', err);
      return [];
    }
  };

  const loadSubjects = async () => {
    try {
      const res = await api.get('/subjects');
      setSubjects(res.data);
    } catch (err) {
      console.error('Failed to load subjects', err);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await api.get('/admin/students/list');
      setStudentsList(res.data);
    } catch (err) {
      console.error('Failed to load students', err);
    }
  };

  const loadQuestions = async () => {
    try {
      const res = await api.get('/admin/questions');
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to load questions', err);
    }
  };

  const loadExams = async () => {
    try {
      const res = await api.get('/admin/exams');
      setExams(res.data);
    } catch (err) {
      console.error('Failed to load exams', err);
      showNotice('error', 'Could not load examinations. Check the API connection and try again.');
    }
  };

  const loadRecords = async () => {
    try {
      const res = await api.get('/admin/students');
      setStudentRecords(res.data);
    } catch (err) {
      console.error('Failed to load assessment records', err);
    }
  };

  const loadSettings = async () => {
    try {
      const [settingsRes, usersRes, backupsRes] = await Promise.all([
        api.get<AssessmentSettings>('/admin/assessment-settings'),
        api.get('/admin/users'),
        api.get('/admin/backup/list')
      ]);
      setSettingsQuestionCount(settingsRes.data.question_count);
      setSettingsTimeLimit(settingsRes.data.time_limit_minutes);
      setAdminUsers(usersRes.data || []);
      setSystemBackups(backupsRes.data || []);
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const loadSystemBackups = async () => {
    try {
      const res = await api.get('/admin/backup/list');
      setSystemBackups(res.data || []);
    } catch (err) {
      console.error('Failed to load system backups', err);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    loadOverview();
    // Initial authentication/bootstrap fetch intentionally runs once per navigation instance.
    // oxlint-disable-next-line react-hooks/exhaustive-deps, react(set-state-in-effect)
  }, [navigate]);

  useEffect(() => {
    loadAcademicData();
    if (activeTab === 'subjects') {
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
    // Loader functions are intentionally scoped to the selected tab.
    // oxlint-disable-next-line react-hooks/exhaustive-deps, react(set-state-in-effect)
  }, [activeTab]);

  useEffect(() => {
    if (showCreateExamModal) void loadQuestions();
    // Load the question bank even when Questions has never been opened.
    // oxlint-disable-next-line react-hooks/exhaustive-deps, react(set-state-in-effect)
  }, [showCreateExamModal]);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await api.post('/admin/backup/create');
      showNotice('success', res.data.message || 'Verified database backup created successfully.');
      await loadSystemBackups();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to create system backup.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleVerifyBackup = async (filename: string) => {
    setVerifyingBackupFilename(filename);
    try {
      const res = await api.post('/admin/backup/verify', { filename });
      setVerifiedBackupResult(res.data);
      showNotice('success', `Backup verified: SHA-256 integrity match (${res.data.recorded_total_records} records).`);
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Backup verification failed.');
    } finally {
      setVerifyingBackupFilename(null);
    }
  };

  const handleManageDepartment = (dept: DepartmentStats) => {
    if (currentUser?.role === 'hod' && currentUser.department_id !== dept.id) {
      showNotice('error', 'Access restricted: HOD can only manage their assigned department.');
      return;
    }
    setSelectedDeptWorkspace(dept);
    setSubjectDeptFilter(String(dept.id));
    setQuestionDeptFilter(String(dept.id));
    setStudentDeptFilter(dept.name);
    setRecordsDeptFilter(dept.name);
    setActiveTab('subjects');
    showNotice('success', `Opened workspace for ${dept.name}.`);
  };

  const handleClearDepartmentWorkspace = () => {
    if (currentUser?.role === 'hod') {
      return; // HOD cannot clear their department restriction
    }
    setSelectedDeptWorkspace(null);
    setSubjectDeptFilter('');
    setQuestionDeptFilter('');
    setStudentDeptFilter('');
    setRecordsDeptFilter('');
    setActiveTab('overview');
    showNotice('success', 'Returned to Department Selection Dashboard.');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  // ==========================================
  // DEPENDENT ACADEMIC HELPERS (SECTION 13)
  // ==========================================

  // Returns years filtered by program
  const getFilteredYears = (progId?: number | '') => {
    if (!progId) return academicYears.filter(y => y.program_id === 1);
    return academicYears.filter(y => y.program_id === progId);
  };

  // Returns semesters filtered by year
  const getFilteredSemesters = (yearId?: number | '', progId?: number | '') => {
    if (yearId) {
      return semesters.filter(s => s.academic_year_id === yearId);
    }
    if (progId) {
      return semesters.filter(s => s.program_id === progId);
    }
    return semesters;
  };

  // Semesters for Student Form (String-based matching)
  const getStudentSemestersForYear = (program: string, year: string) => {
    if (program === 'UG' || program === 'B.Tech') {
      if (year === '1st Year') return ['Semester 1', 'Semester 2'];
      if (year === '2nd Year') return ['Semester 3', 'Semester 4'];
      if (year === '3rd Year') return ['Semester 5', 'Semester 6'];
      if (year === 'Final Year') return ['Semester 7', 'Semester 8'];
      return ['Semester 1', 'Semester 2'];
    } else {
      // M.Tech
      if (year === 'M.Tech 1st Year') return ['Semester 1', 'Semester 2'];
      if (year === 'M.Tech 2nd Year') return ['Semester 3', 'Semester 4'];
      return ['Semester 1', 'Semester 2'];
    }
  };

  // ==========================================
  // 1. DEPARTMENT HANDLERS (SECTIONS 3, 4, 6)
  // ==========================================

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      showNotice('error', 'Department Full Name is required.');
      return;
    }

    setDeptCreating(true);
    try {
      // POST ONLY Department Full Name per Section 3
      const res = await api.post('/departments', { name: trimmed });
      showNotice('success', `Department '${trimmed}' created successfully.`);
      setShowAddDeptModal(false);
      setNewDeptName('');

      // Immediately update local department state without requiring page refresh
      setDepartments(prev => {
        const filtered = prev.filter(d => d.id !== res.data.id);
        return [...filtered, res.data].sort((a, b) => a.name.localeCompare(b.name));
      });

      // Reload academic structure in background
      await loadAcademicData();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to create department.');
    } finally {
      setDeptCreating(false);
    }
  };

  const handleToggleDeptStatus = async (dept: Department) => {
    try {
      const res = await api.patch(`/departments/${dept.id}/status`, { is_active: !dept.is_active });
      showNotice('success', `Department '${dept.name}' ${!dept.is_active ? 'activated' : 'deactivated'}.`);
      setDepartments(prev => prev.map(d => d.id === dept.id ? res.data : d));
      loadAcademicData();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update department status.');
    }
  };

  const openDeleteDeptModal = async (dept: Department) => {
    setDeptToDelete(dept);
    setCheckingDeptDeps(true);
    setDeptDeps(null);
    try {
      const res = await api.get(`/departments/${dept.id}/dependencies`);
      setDeptDeps(res.data);
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to check department dependencies.');
      setDeptToDelete(null);
    } finally {
      setCheckingDeptDeps(false);
    }
  };

  const handleConfirmDeleteDept = async () => {
    if (!deptToDelete) return;
    setIsDeletingDept(true);
    try {
      await api.delete(`/departments/${deptToDelete.id}`);
      showNotice('success', `Department '${deptToDelete.name}' deleted permanently.`);
      setDepartments(prev => prev.filter(d => d.id !== deptToDelete.id));
      setDeptToDelete(null);
      setDeptDeps(null);
      loadAcademicData();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete department.');
    } finally {
      setIsDeletingDept(false);
    }
  };

  // ==========================================
  // 2. SUBJECT HANDLERS (SECTIONS 5, 11, 12, 13, 14, 15)
  // ==========================================

  const openAddSubjectModal = () => {
    setEditingSubject(null);
    setSubjectFormName('');
    setSubjectFormCode('');
    // Default department to HOD's department or selected workspace if active
    const initialDeptId = (currentUser?.role === 'hod' && currentUser.department_id)
      || (selectedDeptWorkspace?.id)
      || (departments.length > 0 ? departments[0].id : '');
    setSubjectFormDeptId(initialDeptId);
    setSubjectFormProgId(programs.length > 0 ? programs[0].id : 1);
    const validYears = getFilteredYears(programs.length > 0 ? programs[0].id : 1);
    const initialYear = validYears.length > 0 ? validYears[0].id : '';
    setSubjectFormYearId(initialYear);
    const validSems = getFilteredSemesters(initialYear);
    setSubjectFormSemId(validSems.length > 0 ? validSems[0].id : '');
    setShowAddSubjectModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectFormName.trim() || !subjectFormCode.trim() || !subjectFormDeptId) {
      showNotice('error', 'Subject Name, Subject Code, and Department are required.');
      return;
    }

    try {
      const payload = {
        name: subjectFormName.trim(),
        code: subjectFormCode.trim(),
        department_id: Number(subjectFormDeptId),
        program_id: subjectFormProgId ? Number(subjectFormProgId) : undefined,
        academic_year_id: subjectFormYearId ? Number(subjectFormYearId) : undefined,
        semester_id: subjectFormSemId ? Number(subjectFormSemId) : undefined,
        is_active: true
      };

      if (editingSubject) {
        const res = await api.put(`/subjects/${editingSubject.id}`, payload);
        showNotice('success', `Subject '${subjectFormName}' updated successfully.`);
        setSubjects(prev => prev.map(s => s.id === editingSubject.id ? res.data : s));
      } else {
        const res = await api.post('/subjects', payload);
        showNotice('success', `Subject '${subjectFormName}' added successfully.`);
        setSubjects(prev => [...prev.filter(s => s.id !== res.data.id), res.data].sort((a, b) => a.name.localeCompare(b.name)));
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
      const res = await api.patch(`/subjects/${subj.id}/status`, { is_active: !subj.is_active });
      showNotice('success', `Subject '${subj.name}' ${!subj.is_active ? 'activated' : 'deactivated'}.`);
      setSubjects(prev => prev.map(s => s.id === subj.id ? res.data : s));
      loadSubjects();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update subject status.');
    }
  };

  const openDeleteSubjectModal = async (subj: Subject) => {
    setDeletingSubject(subj);
    setSubjectDeps({
      loading: true,
      has_dependencies: false,
      can_delete: false,
      question_count: 0,
      exam_count: 0,
      attempt_count: 0,
    });
    try {
      const res = await api.get(`/subjects/${subj.id}/dependencies`);
      setSubjectDeps({
        loading: false,
        has_dependencies: res.data.has_dependencies,
        can_delete: res.data.can_delete,
        question_count: res.data.question_count,
        exam_count: res.data.exam_count,
        attempt_count: res.data.attempt_count,
        answers_count: res.data.answers_count,
        dependency_summary: res.data.dependency_summary,
        reason: res.data.reason,
      });
    } catch (err: any) {
      const localQCnt = questions.filter(q => q.subject_id === subj.id).length;
      const localExamCnt = exams.filter(e => e.subject_id === subj.id).length;
      const hasLocal = localQCnt > 0 || localExamCnt > 0;
      setSubjectDeps({
        loading: false,
        has_dependencies: hasLocal,
        can_delete: !hasLocal,
        question_count: localQCnt,
        exam_count: localExamCnt,
        attempt_count: 0,
        dependency_summary: hasLocal ? `${localQCnt} question(s), ${localExamCnt} exam(s)` : 'None',
        reason: err.response?.data?.detail || (hasLocal ? 'Subject has active dependencies.' : 'Ready for permanent deletion.'),
      });
    }
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    setIsDeletingSubject(true);
    try {
      const res = await api.delete(`/subjects/${deletingSubject.id}`);
      showNotice('success', res.data?.message || `Subject '${deletingSubject.name}' (${deletingSubject.code}) permanently deleted successfully.`);
      setSubjects(prev => prev.filter(s => s.id !== deletingSubject.id));
      setDeletingSubject(null);
      setSubjectDeps(null);
      loadSubjects();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete subject.');
    } finally {
      setIsDeletingSubject(false);
    }
  };

  const handleDeactivateSubjectFromModal = async () => {
    if (!deletingSubject) return;
    setIsDeactivatingSubject(true);
    try {
      const res = await api.patch(`/subjects/${deletingSubject.id}/status`, { is_active: false });
      showNotice('success', `Subject '${deletingSubject.name}' (${deletingSubject.code}) has been deactivated and archived safely. Historical records preserved.`);
      setSubjects(prev => prev.map(s => s.id === deletingSubject.id ? res.data : s));
      setDeletingSubject(null);
      setSubjectDeps(null);
      loadSubjects();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to deactivate subject.');
    } finally {
      setIsDeactivatingSubject(false);
    }
  };

  // ==========================================
  // 3. STUDENT HANDLERS (SECTIONS 7, 8, 9, 10)
  // ==========================================

  const openAddStudentModal = () => {
    setEditingStudent(null);
    setStFormEnrollment('');
    setStFormName('');
    setStFormGender('Male');
    const initialDeptName = (currentUser?.role === 'hod' && currentUser.department_name)
      || (selectedDeptWorkspace?.name)
      || (departments.length > 0 ? departments[0].name : '');
    setStFormDept(initialDeptName);
    setStFormProg('UG');
    setStFormYear('1st Year');
    setStFormSem('Semester 1');
    setStFormPassword('');
    setShowAddStudentModal(true);
  };

  const openBulkImportModal = () => {
    const initialDeptName = (currentUser?.role === 'hod' && currentUser.department_name)
      || (selectedDeptWorkspace?.name)
      || (departments.length > 0 ? departments[0].name : '');
    setImportDept(initialDeptName);
    setImportFile(null);
    setShowBulkImportModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stFormEnrollment.trim() || !stFormName.trim() || !stFormDept.trim()) {
      showNotice('error', 'Enrollment Number, Student Name, and Department are required.');
      return;
    }

    try {
      const payload = {
        enrollment_no: stFormEnrollment.trim(),
        name: stFormName.trim(),
        gender: stFormGender,
        department: stFormDept.trim(),
        program: stFormProg,
        year: stFormYear,
        semester: stFormSem,
        password: stFormPassword.trim() || undefined
      };

      if (editingStudent) {
        const res = await api.put(`/admin/students/${editingStudent.id}`, payload);
        showNotice('success', `Student '${stFormName}' updated.`);
        setStudentsList(prev => prev.map(s => s.id === editingStudent.id ? res.data : s));
      } else {
        const res = await api.post('/admin/students', payload);
        showNotice('success', `Student '${stFormName}' registered with secure credentials.`);
        setStudentsList(prev => [res.data, ...prev.filter(s => s.id !== res.data.id)]);
      }

      setShowAddStudentModal(false);
      setEditingStudent(null);
      setStFormEnrollment('');
      setStFormName('');
      loadStudents();
    } catch (err: any) {
      if (err.response?.status === 409) {
        showNotice('error', 'Student with this Enrollment Number already exists.');
      } else {
        showNotice('error', err.response?.data?.detail || 'Failed to save student.');
      }
    }
  };

  const handleToggleStudentStatus = async (st: Student) => {
    try {
      const res = await api.patch(`/admin/students/${st.id}/status`, { is_active: !st.is_active });
      showNotice('success', `Student '${st.name}' ${!st.is_active ? 'activated' : 'deactivated'}.`);
      setStudentsList(prev => prev.map(s => s.id === st.id ? res.data : s));
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
      if (res.data.credentials?.length) {
        const csvCell = (value: unknown) => {
          const text = String(value ?? '');
          const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
          return `"${safe.replaceAll('"', '""')}"`;
        };
        const rows = [
          ['Enrollment No', 'Temporary Password'].map(csvCell).join(','),
          ...res.data.credentials.map((item: any) => [item.enrollment_no, item.temporary_password].map(csvCell).join(','))
        ];
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `student-temporary-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
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

  const handleQuestionImport = async (previewOnly: boolean) => {
    if (!questionImportFile || !questionImportSubjectId) {
      showNotice('error', 'Select a subject and a CSV, XLSX, or PDF question file.');
      return;
    }
    setQuestionImportLoading(true);
    const formData = new FormData();
    formData.append('file', questionImportFile);
    formData.append('subject_id', String(questionImportSubjectId));
    formData.append('preview_only', String(previewOnly));
    try {
      const res = await api.post('/admin/questions/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setQuestionImportPreview(res.data);
      if (!previewOnly) {
        showNotice('success', res.data.message || 'Questions imported successfully.');
        setShowQuestionImportModal(false);
        setQuestionImportFile(null);
        setQuestionImportPreview(null);
        loadQuestions();
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      showNotice('error', typeof detail === 'string' ? detail : detail?.message || 'Question import failed.');
    } finally {
      setQuestionImportLoading(false);
    }
  };

  const handleRotateSessionCode = async (exam: Exam) => {
    try {
      const res = await api.post(`/admin/exams/${exam.id}/session-code`);
      setSessionCodeDisplay({ examTitle: exam.title, code: res.data.session_code });
      setExams(prev => prev.map(item => item.id === exam.id ? { ...item, has_session_code: true, session_code_rotated_at: res.data.rotated_at } : item));
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Could not generate the session code.');
    }
  };

  // Student Selection & Safe Deletion Handlers
  const toggleSelectStudent = (id: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleOpenDeleteSingleStudent = (st: Student) => {
    setStudentToDelete(st);
    setSelectedStudentIds([st.id]);
    setDeleteConfirmedBackup(false);
    setShowDeleteStudentModal(true);
  };

  const handleOpenDeleteMultipleStudents = () => {
    if (selectedStudentIds.length === 0) return;
    setStudentToDelete(null);
    setDeleteConfirmedBackup(false);
    setShowDeleteStudentModal(true);
  };

  const handleConfirmDeleteStudents = async () => {
    if (selectedStudentIds.length === 0) return;
    if (!deleteConfirmedBackup) {
      showNotice('error', 'Please confirm you have exported backup data before proceeding.');
      return;
    }

    setDeletingStudents(true);
    try {
      if (selectedStudentIds.length === 1) {
        const studentId = selectedStudentIds[0];
        const res = await api.delete(`/admin/students/${studentId}`);
        showNotice('success', res.data.message || 'Student and dependent records safely deleted.');
      } else {
        const res = await api.post('/admin/students/bulk-delete', { student_ids: selectedStudentIds });
        showNotice('success', res.data.message || `Deleted ${res.data.deleted_count} students safely.`);
      }

      setShowDeleteStudentModal(false);
      setStudentToDelete(null);
      setSelectedStudentIds([]);
      setDeleteConfirmedBackup(false);
      loadStudents();
      loadOverview();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete student(s).');
    } finally {
      setDeletingStudents(false);
    }
  };

  const downloadAuthenticatedExport = async (path: string, filename: string, params?: Record<string, string>) => {
    const response = await api.get(path, { params, responseType: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(response.data);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDownloadStudentData = async (format: 'xlsx' | 'csv', specificStudentIds?: number[]) => {
    try {
      const params: Record<string, string> = { format };
      if (studentDeptFilter) params.department = studentDeptFilter;
      if (specificStudentIds?.length) params.student_ids = specificStudentIds.join(',');
      await downloadAuthenticatedExport('/admin/export/students', `students.${format}`, params);
      showNotice('success', `Downloaded ${format.toUpperCase()} student data.`);
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Student export failed.');
    }
  };


  // ==========================================
  // 4. QUESTION HANDLERS (SECTIONS 7, 16, 24)
  // ==========================================

  const openAddQuestionModal = () => {
    setEditingQuestion(null);
    setQFormText('');
    setQFormOptA('');
    setQFormOptB('');
    setQFormOptC('');
    setQFormOptD('');
    setQFormCorrect('A');
    setQFormTopic('Data Structures');
    setQFormDifficulty('Medium');
    setQFormMarks(1);
    const initialDeptId = (currentUser?.role === 'hod' && currentUser.department_id)
      || (selectedDeptWorkspace?.id)
      || (departments.length > 0 ? departments[0].id : '');
    setQFormDeptId(initialDeptId);
    setQFormSubjectId(subjects.length > 0 ? subjects[0].id : '');
    setShowAddQuestionModal(true);
  };

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
        subject_id: qFormSubjectId ? Number(qFormSubjectId) : undefined,
        department_id: qFormDeptId ? Number(qFormDeptId) : undefined,
        is_active: true
      };

      if (editingQuestion) {
        const res = await api.put(`/admin/questions/${editingQuestion.id}`, payload);
        showNotice('success', `Question #${editingQuestion.id} updated.`);
        setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? res.data : q));
      } else {
        const res = await api.post('/admin/questions', payload);
        showNotice('success', 'Question added to question bank.');
        setQuestions(prev => [res.data, ...prev]);
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
      const res = await api.patch(`/admin/questions/${q.id}/status`, { is_active: !q.is_active });
      showNotice('success', `Question #${q.id} ${!q.is_active ? 'activated' : 'deactivated'}.`);
      setQuestions(prev => prev.map(item => item.id === q.id ? res.data : item));
      loadQuestions();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update question status.');
    }
  };

  const openDeleteQuestionModal = async (q: AdminQuestion) => {
    setDeletingQuestion(q);
    setCheckingQuestionDeps(true);
    setQuestionDeps(null);
    try {
      const res = await api.get(`/admin/questions/${q.id}/dependencies`);
      setQuestionDeps(res.data);
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to check question dependencies.');
      setDeletingQuestion(null);
    } finally {
      setCheckingQuestionDeps(false);
    }
  };

  const handleDeactivateQuestionFromModal = async () => {
    if (!deletingQuestion) return;
    try {
      await api.post(`/admin/questions/${deletingQuestion.id}/deactivate`);
      showNotice('success', `Question #${deletingQuestion.id} deactivated successfully. Historical test records protected.`);
      setQuestions(prev => prev.map(item => item.id === deletingQuestion.id ? { ...item, is_active: false } : item));
      setDeletingQuestion(null);
      setQuestionDeps(null);
      loadQuestions();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to deactivate question.');
    }
  };

  const handleConfirmDeleteQuestion = async () => {
    if (!deletingQuestion) return;
    setIsDeletingQuestion(true);
    try {
      await api.delete(`/admin/questions/${deletingQuestion.id}`);
      showNotice('success', `Question #${deletingQuestion.id} deleted permanently.`);
      setQuestions(prev => prev.filter(q => q.id !== deletingQuestion.id));
      setSelectedQuestionIds(prev => prev.filter(id => id !== deletingQuestion.id));
      setDeletingQuestion(null);
      setQuestionDeps(null);
      loadQuestions();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete question.');
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  // ==========================================
  // 5. EXAM HANDLERS (SECTIONS 14, 15, 17, 18, 19, 20, 21, 22)
  // ==========================================

  const handleExamDeptChange = async (newDeptId: number | '') => {
    setExamFormDeptId(newDeptId);
    setExamFormSubjectId(''); // Requirement 2: Changing department must clear any invalid previous selection!
    setExamSelectedQuestionIds([]);
    if (newDeptId) {
      try {
        const res = await api.get<Subject[]>('/subjects', {
          params: { department_id: newDeptId, is_active: true }
        });
        setSubjects(prev => {
          const others = prev.filter(s => s.department_id !== newDeptId);
          return [...others, ...res.data].sort((a, b) => a.name.localeCompare(b.name));
        });
      } catch (err) {
        console.error('Failed to reload department subjects', err);
      }
    }
  };

  const openCreateExamModal = async () => {
    setEditingExam(null);
    setExamFormTitle('');
    setExamFormCode('');

    // Pre-fill academic parameters
    const initialDeptId = (currentUser?.role === 'hod' && currentUser.department_id)
      || (selectedDeptWorkspace?.id)
      || (departments.length > 0 ? departments[0].id : '');
    setExamFormDeptId(initialDeptId);
    setExamFormSubjectId(''); // Cleared so user makes an explicit valid selection

    const initialProgId = programs.length > 0 ? programs[0].id : '';
    setExamFormProgId(initialProgId);
    const validYears = getFilteredYears(initialProgId);
    const initialYearId = validYears.length > 0 ? validYears[0].id : '';
    setExamFormYearId(initialYearId);
    const validSems = getFilteredSemesters(initialYearId, initialProgId);
    const initialSemId = validSems.length > 0 ? validSems[0].id : '';
    setExamFormSemId(initialSemId);

    if (initialDeptId) {
      try {
        const res = await api.get<Subject[]>('/subjects', {
          params: { department_id: initialDeptId, is_active: true }
        });
        setSubjects(prev => {
          const others = prev.filter(s => s.department_id !== initialDeptId);
          return [...others, ...res.data].sort((a, b) => a.name.localeCompare(b.name));
        });
      } catch (err) {
        console.error('Failed to fetch subjects for department', err);
      }
    }

    setExamFormDuration(60);
    setExamFormQuestionsCount(25);
    setExamFormMarksPerQ(1);
    setExamFormPassingPct(40);
    setExamFormSelectionMode('random');
    setExamFormStatus('published');
    setExamFormStartDate('');
    setExamFormStartTime('');
    setExamFormEndDate('');
    setExamFormEndTime('');
    setExamFormResultRelease('after_close');
    setExamSelectedQuestionIds([]);
    setShowCreateExamModal(true);
  };

  const openEditExamModal = async (exam: Exam) => {
    try {
      const { data } = await api.get<Exam>(`/admin/exams/${exam.id}`);
      setEditingExam(data);
      setExamFormTitle(data.title);
      setExamFormCode(data.code || '');
      setExamFormDeptId(data.department_id || '');
      setExamFormProgId(data.program_id || '');
      setExamFormYearId(data.academic_year_id || '');
      setExamFormSemId(data.semester_id || '');
      setExamFormSubjectId(data.subject_id || '');
      setExamFormDuration(data.duration_minutes);
      setExamFormQuestionsCount(data.total_questions);
      setExamFormMarksPerQ(data.marks_per_question);
      setExamFormPassingPct(data.passing_percentage);
      setExamFormSelectionMode(data.selection_mode as 'random' | 'manual');
      setExamFormStatus(data.status);
      setExamFormStartDate(data.start_date || '');
      setExamFormStartTime(data.start_time || '');
      setExamFormEndDate(data.end_date || '');
      setExamFormEndTime(data.end_time || '');
      setExamFormResultRelease(data.result_release_mode);
      setExamSelectedQuestionIds(data.selected_question_ids || []);
      setShowCreateExamModal(true);
    } catch {
      showNotice('error', 'Could not open this examination. Please retry.');
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (examSaving) return;
    if (!examFormTitle.trim()) {
      showNotice('error', 'Exam Title is required.');
      return;
    }
    if (!examFormDeptId) {
      showNotice('error', 'Department is required. Please select a Department for this examination.');
      return;
    }
    if (!examFormSubjectId) {
      showNotice('error', 'Subject is required. Please select a Subject for this examination.');
      return;
    }
    if (examFormSelectionMode === 'manual' && examSelectedQuestionIds.length !== examFormQuestionsCount) {
      showNotice('error', `Select exactly ${examFormQuestionsCount} active questions for manual mode.`);
      return;
    }

    setExamSaving(true);
    try {
      const payload = {
        title: examFormTitle.trim(),
        code: examFormCode.trim() || null,
        subject_id: Number(examFormSubjectId),
        department_id: Number(examFormDeptId),
        program_id: examFormProgId ? Number(examFormProgId) : undefined,
        academic_year_id: examFormYearId ? Number(examFormYearId) : undefined,
        semester_id: examFormSemId ? Number(examFormSemId) : undefined,
        duration_minutes: examFormDuration,
        total_questions: examFormQuestionsCount,
        marks_per_question: examFormMarksPerQ,
        total_marks: examFormQuestionsCount * examFormMarksPerQ,
        passing_percentage: examFormPassingPct,
        selection_mode: examFormSelectionMode,
        selected_question_ids: examFormSelectionMode === 'manual' ? examSelectedQuestionIds : undefined,
        status: examFormStatus,
        start_date: examFormStartDate || null,
        start_time: examFormStartTime || null,
        end_date: examFormEndDate || null,
        end_time: examFormEndTime || null,
        result_release_mode: examFormResultRelease
      };

      if (editingExam) {
        const res = await api.put(`/admin/exams/${editingExam.id}`, payload);
        showNotice('success', `Exam '${examFormTitle}' updated successfully.`);
        setExams(prev => prev.map(ex => ex.id === editingExam.id ? res.data : ex));
      } else {
        const res = await api.post('/admin/exams', payload);
        showNotice('success', `Exam '${examFormTitle}' created successfully.`);
        setExams(prev => [res.data, ...prev]);
      }

      setShowCreateExamModal(false);
      setEditingExam(null);
      setExamFormTitle('');
      setExamFormCode('');
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to save exam.');
    } finally {
      setExamSaving(false);
    }
  };

  const handleToggleExamStatus = async (exam: Exam, newStatus: string) => {
    try {
      const res = await api.patch(`/admin/exams/${exam.id}/status?status_name=${newStatus}`, { is_active: true });
      showNotice('success', `Exam '${exam.title}' status changed to ${newStatus}.`);
      setExams(prev => prev.map(e => e.id === exam.id ? res.data : e));
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update exam status.');
    }
  };

  // Safe Delete & Archive Examination Handlers
  const handleOpenDeleteExam = (exam: Exam) => {
    setExamToDelete(exam);
    setShowExamDeleteModal(true);
  };

  const handleConfirmDeleteExam = async () => {
    if (!examToDelete) return;
    setExamDeleteLoading(true);
    try {
      const res = await api.delete(`/admin/exams/${examToDelete.id}`);
      showNotice('success', res.data?.message || `Examination '${examToDelete.title}' deleted successfully.`);
      setExams(prev => prev.filter(e => e.id !== examToDelete.id));
      setShowExamDeleteModal(false);
      setExamToDelete(null);
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete examination.');
    } finally {
      setExamDeleteLoading(false);
    }
  };

  const handleOpenArchiveExam = (exam: Exam) => {
    setExamToArchive(exam);
    setShowExamArchiveModal(true);
  };

  const handleConfirmArchiveExam = async (examTarget?: Exam) => {
    const target = examTarget || examToArchive || examToDelete;
    if (!target) return;
    setExamArchiveLoading(true);
    try {
      const res = await api.post(`/admin/exams/${target.id}/archive`);
      showNotice('success', res.data?.message || `Examination '${target.title}' archived successfully. Historical attempts and marks are protected.`);
      setExams(prev => prev.map(e => e.id === target.id ? { ...e, status: 'archived', is_active: false } : e));
      setShowExamArchiveModal(false);
      setShowExamDeleteModal(false);
      setExamToArchive(null);
      setExamToDelete(null);
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to archive examination.');
    } finally {
      setExamArchiveLoading(false);
    }
  };

  const handleUnarchiveExam = async (exam: Exam) => {
    try {
      const res = await api.post(`/admin/exams/${exam.id}/unarchive`);
      showNotice('success', res.data?.message || `Examination '${exam.title}' restored to draft status.`);
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, status: 'draft', is_active: true } : e));
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to restore examination.');
    }
  };

  // Student Assignment Modal
  const openAssignModal = async (exam: Exam) => {
    try {
      const [stRes, assignedRes] = await Promise.all([
        api.get<Student[]>('/admin/students/list'),
        api.get<AssignedStudent[]>(`/admin/exams/${exam.id}/students`)
      ]);
      setStudentsList(stRes.data);
      setAssignedStudents(assignedRes.data);
      setSelectedStudentIdsToAssign(assignedRes.data.map(s => s.student_id));
      setAssigningExam(exam);
      if (exam.department_name) {
        setAssignFilterDept(exam.department_name);
      } else {
        setAssignFilterDept('');
      }
    } catch (err) {
      console.error('Failed to load students for assignment', err);
      showNotice('error', 'Could not load student assignments. Please retry.');
    }
  };

  const handleSaveStudentAssignments = async () => {
    if (!assigningExam) return;
    try {
      const res = await api.post(`/admin/exams/${assigningExam.id}/assign`, {
        student_ids: selectedStudentIdsToAssign,
        replace: true,
      });
      showNotice('success', res.data.message || 'Student assignments updated successfully.');
      setAssigningExam(null);
      loadExams();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to assign students.');
    }
  };

  // ==========================================
  // 6. ATTEMPT RECORDS & INSPECT & SETTINGS
  // ==========================================

  const handleInspectAttempt = async (rec: StudentSummary) => {
    if (!rec.student_id) return;
    try {
      const res = await api.get(`/admin/students/${rec.student_id}${rec.attempt_id ? `?attempt_id=${rec.attempt_id}` : ''}`);
      setInspectingAttempt(res.data);
    } catch {
      showNotice('error', 'Failed to load attempt details.');
    }
  };

  const openDeleteAttemptModal = async (rec: StudentSummary) => {
    if (!rec.attempt_id) return;
    setDeletingAttempt(rec);
    setCheckingAttemptDeps(true);
    setAttemptDeps(null);
    try {
      const res = await api.get(`/admin/attempts/${rec.attempt_id}/dependencies`);
      setAttemptDeps(res.data);
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to check attempt dependencies.');
      setDeletingAttempt(null);
    } finally {
      setCheckingAttemptDeps(false);
    }
  };

  const handleConfirmDeleteAttempt = async () => {
    if (!deletingAttempt || !deletingAttempt.attempt_id) return;
    setIsDeletingAttempt(true);
    try {
      await api.delete(`/admin/attempts/${deletingAttempt.attempt_id}`);
      showNotice('success', `Assessment attempt #${deletingAttempt.attempt_id} deleted permanently.`);
      setStudentRecords(prev => prev.filter(r => r.attempt_id !== deletingAttempt.attempt_id));
      setSelectedRecordAttemptIds(prev => prev.filter(id => id !== deletingAttempt.attempt_id));
      setDeletingAttempt(null);
      setAttemptDeps(null);
      loadRecords();
      loadOverview();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete attempt.');
    } finally {
      setIsDeletingAttempt(false);
    }
  };

  const handleDeleteUser = (user: AdminUser) => {
    if (currentUser?.username === user.username) {
      showNotice('error', 'Cannot delete your own currently active administrator session.');
      return;
    }
    setDeletingUser(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    try {
      await api.delete(`/admin/users/${deletingUser.id}?permanent=true`);
      showNotice('success', `User '${deletingUser.username}' deleted permanently.`);
      setAdminUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      setSelectedUserIds(prev => prev.filter(id => id !== deletingUser.id));
      setDeletingUser(null);
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete user.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Universal High-Impact Bulk Delete Execution (Atomic Backend Operations)
  const handleExecuteBulkDelete = async () => {
    if (!bulkDeleteConfig) return;
    if (bulkDeleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      showNotice('error', "Type 'DELETE' in uppercase to confirm permanent bulk deletion.");
      return;
    }
    setIsBulkDeleting(true);
    try {
      const { type, ids } = bulkDeleteConfig;
      if (type === 'subjects') {
        const res = await api.post('/subjects/bulk-delete', { ids, confirm_text: 'DELETE' });
        showNotice('success', res.data.message || `Deleted ${res.data.deleted_count} subjects.`);
        setSubjects(prev => prev.filter(s => !ids.includes(s.id)));
        setSelectedSubjectIds([]);
      } else if (type === 'questions') {
        const res = await api.post('/admin/questions/bulk-delete', { ids, confirm_text: 'DELETE' });
        showNotice('success', res.data.message || `Deleted ${res.data.deleted_count} questions.`);
        setQuestions(prev => prev.filter(q => !ids.includes(q.id)));
        setSelectedQuestionIds([]);
      } else if (type === 'exams') {
        const res = await api.post('/admin/exams/bulk-delete', { ids, confirm_text: 'DELETE' });
        showNotice('success', res.data.message || `Deleted ${res.data.deleted_count} exams.`);
        setExams(prev => prev.filter(e => !ids.includes(e.id)));
        setSelectedExamIds([]);
      } else if (type === 'attempts') {
        const res = await api.post('/admin/attempts/bulk-delete', { ids, confirm_text: 'DELETE' });
        showNotice('success', res.data.message || `Deleted ${res.data.deleted_count} assessment attempts.`);
        setStudentRecords(prev => prev.filter(r => !r.attempt_id || !ids.includes(r.attempt_id)));
        setSelectedRecordAttemptIds([]);
        loadOverview();
      } else if (type === 'users') {
        const res = await api.post('/admin/users/bulk-delete', { ids, confirm_text: 'DELETE' });
        showNotice('success', res.data.message || `Deleted ${res.data.deleted_count} administrative accounts.`);
        setAdminUsers(prev => prev.filter(u => !ids.includes(u.id)));
        setSelectedUserIds([]);
      }
      setBulkDeleteConfig(null);
      setBulkDeleteConfirmText('');
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Bulk deletion failed. Please review dependencies.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await api.put('/admin/assessment-settings', {
        question_count: settingsQuestionCount,
        time_limit_minutes: settingsTimeLimit
      });
      showNotice('success', 'Default assessment settings updated successfully.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to update settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleExportExcel = async () => {
    await downloadAuthenticatedExport('/admin/export/excel', 'assessment-results.xlsx');
  };

  const handleExportCSV = async () => {
    await downloadAuthenticatedExport('/admin/export/csv', 'assessment-results.csv');
  };

  // Filtered Subjects for Exam Modal strictly bounded to selected Department
  const displayExamSubjects = examFormDeptId
    ? subjects.filter(s => {
        if (!s.is_active) return false;
        if (s.department_id !== Number(examFormDeptId)) return false;
        return true;
      })
    : [];
  const examBankQuestions = questions.filter(question => question.is_active && question.subject_id === Number(examFormSubjectId));

  const filteredSubjects = subjects.filter((s) => {
    const matchSearch = !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase()) || s.code.toLowerCase().includes(subjectSearch.toLowerCase());
    const matchDept = !subjectDeptFilter || s.department_id.toString() === subjectDeptFilter;
    const matchStatus = subjectStatusFilter === 'all' || (subjectStatusFilter === 'active' ? s.is_active : !s.is_active);
    return matchSearch && matchDept && matchStatus;
  });

  const filteredQuestions = questions.filter((q) => {
    const matchSearch = !questionSearch || q.question_text.toLowerCase().includes(questionSearch.toLowerCase()) || (q.topic && q.topic.toLowerCase().includes(questionSearch.toLowerCase()));
    const matchDept = !questionDeptFilter || q.department_id?.toString() === questionDeptFilter;
    const matchSubj = !questionSubjectFilter || q.subject_id?.toString() === questionSubjectFilter;
    const matchStatus = questionStatusFilter === 'all' || (questionStatusFilter === 'active' ? q.is_active : !q.is_active);
    return matchSearch && matchDept && matchSubj && matchStatus;
  });

  const filteredExams = exams.filter((ex) => {
    const matchSearch = !examSearch || ex.title.toLowerCase().includes(examSearch.toLowerCase()) || (ex.subject_name && ex.subject_name.toLowerCase().includes(examSearch.toLowerCase()));
    const matchStatus = !examStatusFilter || ex.status === examStatusFilter;
    return matchSearch && matchStatus;
  });

  const filteredRecords = studentRecords.filter((rec) => {
    const matchSearch = !recordsSearch || rec.name.toLowerCase().includes(recordsSearch.toLowerCase()) || rec.enrollment_no.toLowerCase().includes(recordsSearch.toLowerCase());
    const matchDept = !recordsDeptFilter || rec.department === recordsDeptFilter;
    return matchSearch && matchDept;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Loading Institutional Examination Management Desk...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col">
      {/* Top Admin Header — Official College Branding */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">

          {/* Left: College Identity + App Name */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <CollegeBranding size="sm" />
            <div className="hidden md:block w-px h-10 bg-slate-200 flex-shrink-0" />
            <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
              <div className="p-1.5 bg-blue-600 rounded-lg shadow-sm shadow-blue-500/20">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                  <span>College Examination &amp; Assessment System</span>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold uppercase tracking-wider">
                    Admin Panel
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500">Institutional Examination &amp; Assessment Management Desk</p>
              </div>
            </div>
          </div>

          {/* Right: User Profile & Controls */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900">{currentUser?.full_name || 'Administrator'}</p>
              <p className="text-[10px] font-medium">
                {currentUser?.role === 'hod' ? (
                  <span className="text-amber-400 font-semibold flex items-center justify-end space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>HOD • {currentUser.department_name || `Dept #${currentUser.department_id}`}</span>
                  </span>
                ) : (
                  <span className="text-blue-700 font-semibold flex items-center justify-end space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    <span>Super Administrator (All Access)</span>
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={() => {
                loadOverview();
                showNotice('success', 'Dashboard synced with database.');
              }}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Refresh Dashboard"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 max-w-md animate-in slide-in-from-top-4 duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-start space-x-3 ${notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
            }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-semibold flex-1 leading-relaxed">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs: Swapped between Institution Top Nav and Department Workspace Nav */}
      {!selectedDeptWorkspace ? (
        <nav className="bg-white border-b border-slate-200 px-6 overflow-x-auto shadow-xs">
          <div className="max-w-7xl mx-auto flex space-x-1 py-2 text-xs font-semibold whitespace-nowrap">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('academic')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'academic'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Academic Structure</span>
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'subjects'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Subject Management</span>
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Student Management</span>
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Question Bank</span>
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'exams'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Exam Management</span>
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Assessment Records</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => setActiveTab('exports')}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'exports'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Reports &amp; Exports</span>
            </button>
          </div>
        </nav>
      ) : (
        <nav className="bg-white border-b border-slate-200 px-6 py-2.5 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              {currentUser?.role !== 'hod' && (
                <button
                  onClick={handleClearDepartmentWorkspace}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                  title="Return to department selection dashboard"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Departments</span>
                </button>
              )}
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-mono text-xs font-bold">
                  {selectedDeptWorkspace.code || 'DEPT'}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {selectedDeptWorkspace.name}
                </span>
                {currentUser?.role === 'hod' ? (
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold">
                    Assigned Department
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold">
                    Department Workspace
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1 overflow-x-auto text-xs font-semibold">
              <button
                onClick={() => setActiveTab('subjects')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'subjects'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Subjects ({selectedDeptWorkspace.active_subjects_count})</span>
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'students'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Students ({selectedDeptWorkspace.students_count})</span>
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'questions'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Questions</span>
              </button>
              <button
                onClick={() => setActiveTab('exams')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'exams'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Exams ({selectedDeptWorkspace.exams_count})</span>
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'records'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Assessment Records</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
              <button
                onClick={() => setActiveTab('exports')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'exports'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Reports &amp; Exports</span>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {selectedDeptWorkspace && (
          <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {selectedDeptWorkspace.name} ({selectedDeptWorkspace.code || 'DEPT'})
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedDeptWorkspace.students_count} Enrolled Students • {selectedDeptWorkspace.active_subjects_count} Active Subjects • {selectedDeptWorkspace.exams_count} Exams ({selectedDeptWorkspace.active_exams_count} Active)
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Department Workspace: <span className="font-semibold text-slate-700 capitalize">{activeTab}</span>
            </div>
          </div>
        )}

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">Total Departments</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{deptStats.length || departments.length}</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                    <Building className="w-6 h-6" />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">Active Subjects</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{subjects.filter(s => s.is_active).length}</p>
                  </div>
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">Enrolled Students</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{studentsList.length || stats?.total_students || 0}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">Active Exams</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{exams.filter(e => e.status === 'published').length}</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                    <Calendar className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>

            {/* Department Selection Dashboard — 10 Approved Institutional Departments */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    <span>Department Selection Dashboard</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live database-backed statistics for departments at Government College of Engineering, Chhatrapati Sambhajinagar
                  </p>
                </div>
                {currentUser?.role !== 'hod' && (
                  <button
                    onClick={() => setShowAddDeptModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Department</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deptStats.map((d) => {
                  const isAssigned = currentUser?.role === 'hod' && currentUser.department_id === d.id;
                  const isForbidden = currentUser?.role === 'hod' && currentUser.department_id !== d.id;
                  const isSelected = selectedDeptWorkspace?.id === d.id;

                  return (
                    <div
                      key={d.id}
                      className={`bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md flex flex-col justify-between transition-all duration-200 ${
                        isAssigned
                          ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-400/40'
                          : isSelected
                          ? 'border-blue-500 bg-[#F0F6FF] ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div>
                        {/* Header Badges: Short Code Badge & Active Status */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-lg text-xs font-mono font-bold tracking-wider">
                            {d.code || 'DEPT'}
                          </span>
                          <div className="flex items-center space-x-1.5 flex-wrap justify-end gap-y-1">
                            {isAssigned && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold">
                                Your Department
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              d.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${d.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {d.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>

                        {/* Full Department Name Prominently Displayed (No truncation, natural wrap) */}
                        <h4 className="text-base sm:text-lg font-bold text-[#1E293B] leading-snug tracking-tight mb-4 min-h-[3.25rem] flex items-center">
                          {d.name}
                        </h4>

                        {/* Live Metrics Grid from GET /api/departments/stats - Light Cards */}
                        <div className="grid grid-cols-2 gap-2.5 mb-5">
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 transition-colors">
                            <span className="text-[11px] text-slate-500 block font-medium">Students</span>
                            <span className="text-xl font-bold text-[#1E293B] mt-0.5 block">{d.students_count}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 transition-colors">
                            <span className="text-[11px] text-slate-500 block font-medium">Active Subjects</span>
                            <span className="text-xl font-bold text-indigo-700 mt-0.5 block">{d.active_subjects_count}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 transition-colors">
                            <span className="text-[11px] text-slate-500 block font-medium">Total Exams</span>
                            <span className="text-xl font-bold text-purple-700 mt-0.5 block">{d.exams_count}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 transition-colors">
                            <span className="text-[11px] text-slate-500 block font-medium">Active Exams</span>
                            <span className="text-xl font-bold text-emerald-700 mt-0.5 block">{d.active_exams_count}</span>
                          </div>
                        </div>
                      </div>

                      {/* Manage Department Action Button */}
                      <button
                        onClick={() => handleManageDepartment(d)}
                        disabled={isForbidden}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                          isForbidden
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md active:scale-[0.99]'
                        }`}
                      >
                        {isForbidden ? (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Restricted (Other Dept)</span>
                          </>
                        ) : (
                          <>
                            <span>Manage Department</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Action Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
              <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 space-y-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  <span>Departments</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Manage academic engineering departments. Create new departments with automatic availability across the entire system.
                </p>
                {currentUser?.role !== 'hod' ? (
                  <button
                    onClick={() => setShowAddDeptModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    + Add Department
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 italic block">Department management is Super Admin only.</span>
                )}
              </div>

              <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 space-y-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <span>Manual Subjects</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Administrators manually define subject courses and map them to department and semester structures.
                </p>
                <button
                  onClick={openAddSubjectModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  + Add Subject
                </button>
              </div>

              <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 space-y-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <span>Examinations</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Create internal exams, specify duration and marks, and enforce strict student-specific exam access authorization.
                </p>
                <button
                  onClick={openCreateExamModal}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  + Create Exam
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. ACADEMIC STRUCTURE TAB */}
        {activeTab === 'academic' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  <span>Department Management</span>
                </h3>
                <p className="text-xs text-slate-400">Institutional academic departments and branches</p>
              </div>
              <button
                onClick={() => setShowAddDeptModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Department</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((d) => (
                <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 text-blue-600 rounded-xl">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{d.name}</h4>
                      <span className="text-[11px] text-slate-500 font-mono">ID: {d.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleDeptStatus(d)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${d.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                    >
                      {d.is_active ? 'Active' : 'Inactive'}
                    </button>
                    {currentUser?.role === 'super_admin' && (
                      <button
                        onClick={() => openDeleteDeptModal(d)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Department Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Academic Program Hierarchy */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Academic Program Hierarchy</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* UG Programs */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center space-x-2 text-blue-600 font-bold text-sm">
                    <GraduationCap className="w-4 h-4" />
                    <span>Undergraduate (UG / B.Tech)</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {academicYears.filter(y => y.program_id === 1 || (y.name.includes('Year') && !y.name.includes('M.Tech'))).map(yr => (
                      <div key={yr.id} className="pl-3 border-l-2 border-slate-200 py-1 space-y-1">
                        <span className="text-slate-200 font-bold block">{yr.name}</span>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {semesters.filter(s => s.academic_year_id === yr.id).map(sem => (
                            <span key={sem.id} className="px-2 py-0.5 bg-white border border-slate-200 rounded">
                              {sem.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* M.Tech Programs */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                    <GraduationCap className="w-4 h-4" />
                    <span>Postgraduate (M.Tech)</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {academicYears.filter(y => y.name.includes('M.Tech')).map(yr => (
                      <div key={yr.id} className="pl-3 border-l-2 border-slate-200 py-1 space-y-1">
                        <span className="text-slate-200 font-bold block">{yr.name}</span>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {semesters.filter(s => s.academic_year_id === yr.id).map(sem => (
                            <span key={sem.id} className="px-2 py-0.5 bg-white border border-slate-200 rounded">
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
                <h3 className="text-lg font-bold text-slate-900">Student Directory & Credentials</h3>
                <p className="text-xs text-slate-400">Manage enrolled students, unique roll numbers, and login status</p>
              </div>

              <div className="flex items-center flex-wrap gap-2.5">
                {/* Download Student Data Button (Excel / CSV) */}
                <button
                  onClick={() => setShowExportOptionsModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                  title="Export student records and examination results as Excel or CSV"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Student Data</span>
                </button>

                {/* Bulk Import */}
                <button
                  onClick={openBulkImportModal}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-200 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Bulk Import</span>
                </button>

                {/* Add Student */}
                <button
                  onClick={openAddStudentModal}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add Student</span>
                </button>

                {/* Multi-Delete Action when 1 or more students are checked */}
                {selectedStudentIds.length > 0 && (
                  <button
                    onClick={handleOpenDeleteMultipleStudents}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer animate-pulse"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected ({selectedStudentIds.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Selection Banner if students are selected */}
            {selectedStudentIds.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="font-bold">
                    {selectedStudentIds.length} student{selectedStudentIds.length > 1 ? 's' : ''} selected for management
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDownloadStudentData('xlsx', selectedStudentIds)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    title="Export backup of selected students"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export Selected (XLSX)</span>
                  </button>
                  <button
                    onClick={handleOpenDeleteMultipleStudents}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedStudentIds.length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedStudentIds([])}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by Roll No or Name..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={studentDeptFilter}
                onChange={(e) => setStudentDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Students Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            studentsList.filter((st) => {
                              const matchSearch = !studentSearch || st.enrollment_no.toLowerCase().includes(studentSearch.toLowerCase()) || st.name.toLowerCase().includes(studentSearch.toLowerCase());
                              const matchDept = !studentDeptFilter || st.department === studentDeptFilter;
                              return matchSearch && matchDept;
                            }).length > 0 &&
                            studentsList.filter((st) => {
                              const matchSearch = !studentSearch || st.enrollment_no.toLowerCase().includes(studentSearch.toLowerCase()) || st.name.toLowerCase().includes(studentSearch.toLowerCase());
                              const matchDept = !studentDeptFilter || st.department === studentDeptFilter;
                              return matchSearch && matchDept;
                            }).every(st => selectedStudentIds.includes(st.id))
                          }
                          onChange={() => {
                            const filtered = studentsList.filter((st) => {
                              const matchSearch = !studentSearch || st.enrollment_no.toLowerCase().includes(studentSearch.toLowerCase()) || st.name.toLowerCase().includes(studentSearch.toLowerCase());
                              const matchDept = !studentDeptFilter || st.department === studentDeptFilter;
                              return matchSearch && matchDept;
                            });
                            const filteredIds = filtered.map(s => s.id);
                            const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedStudentIds.includes(id));
                            if (allSelected) {
                              setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
                            } else {
                              setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Select all filtered students"
                        />
                      </th>
                      <th className="py-3.5 px-4">Roll / Enrollment No</th>
                      <th className="py-3.5 px-4">Student Name</th>
                      <th className="py-3.5 px-4">Gender</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Program / Year / Sem</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentsList
                      .filter((st) => {
                        const matchSearch = !studentSearch || st.enrollment_no.toLowerCase().includes(studentSearch.toLowerCase()) || st.name.toLowerCase().includes(studentSearch.toLowerCase());
                        const matchDept = !studentDeptFilter || st.department === studentDeptFilter;
                        return matchSearch && matchDept;
                      })
                      .map((st) => (
                        <tr key={st.id} className={`transition-colors ${selectedStudentIds.includes(st.id) ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'}`}>
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(st.id)}
                              onChange={() => toggleSelectStudent(st.id)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{st.enrollment_no}</td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">{st.name}</td>
                          <td className="py-3.5 px-4 text-slate-500">{st.gender || '-'}</td>
                          <td className="py-3.5 px-4 text-slate-700">{st.department}</td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {st.program || 'UG'} • {st.year || '1st Year'} • {st.semester || 'Sem 1'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                              {st.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
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
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStudentStatus(st)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${st.is_active
                                  ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              title={st.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteSingleStudent(st)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Student Safely"
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

        {/* 4. SUBJECT MANAGEMENT TAB */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <span>Subject Management</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Subjects are created manually by the administrator and mapped to departments and semesters.
                </p>
                <div className="flex items-center space-x-2 mt-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    Total: {subjects.length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    Active: {subjects.filter(s => s.is_active).length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                    Inactive: {subjects.filter(s => !s.is_active).length}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {selectedSubjectIds.length > 0 && (
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'subjects',
                        ids: selectedSubjectIds,
                        title: `Bulk Delete ${selectedSubjectIds.length} Subject(s)`,
                        description: `Permanently delete ${selectedSubjectIds.length} selected subjects from the institution database.`,
                        itemCount: selectedSubjectIds.length,
                        impactDetails: 'Any subjects linked to active examinations or question banks will be safely blocked by atomic backend verification to protect institutional integrity.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected ({selectedSubjectIds.length})</span>
                  </button>
                )}
                <button
                  onClick={openAddSubjectModal}
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Subject</span>
                </button>
              </div>
            </div>

            {/* Selection Banner if subjects are checked */}
            {selectedSubjectIds.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="font-bold">
                    {selectedSubjectIds.length} subject{selectedSubjectIds.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {filteredSubjects.length > selectedSubjectIds.length && (
                    <button
                      onClick={() => {
                        const allFilteredIds = filteredSubjects.map(s => s.id);
                        setSelectedSubjectIds(Array.from(new Set([...selectedSubjectIds, ...allFilteredIds])));
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      Select All Matching ({filteredSubjects.length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'subjects',
                        ids: selectedSubjectIds,
                        title: `Bulk Delete ${selectedSubjectIds.length} Subject(s)`,
                        description: `Permanently delete ${selectedSubjectIds.length} selected subjects from the institution database.`,
                        itemCount: selectedSubjectIds.length,
                        impactDetails: 'Any subjects linked to active examinations or question banks will be safely blocked by atomic backend verification to protect institutional integrity.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedSubjectIds.length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedSubjectIds([])}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search subject by name or code..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={subjectDeptFilter}
                onChange={(e) => setSubjectDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id.toString()}>{d.name}</option>
                ))}
              </select>

              <select
                value={subjectStatusFilter}
                onChange={(e) => setSubjectStatusFilter(e.target.value as any)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Subjects Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={filteredSubjects.length > 0 && filteredSubjects.every(s => selectedSubjectIds.includes(s.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const ids = filteredSubjects.map(s => s.id);
                              setSelectedSubjectIds(prev => Array.from(new Set([...prev, ...ids])));
                            } else {
                              const idsSet = new Set(filteredSubjects.map(s => s.id));
                              setSelectedSubjectIds(prev => prev.filter(id => !idsSet.has(id)));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Select all matching subjects on this page"
                        />
                      </th>
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
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          No matching subjects found. Click "+ Add Subject" to manually add a subject.
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((subj) => (
                        <tr key={subj.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <input
                              type="checkbox"
                              checked={selectedSubjectIds.includes(subj.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSubjectIds(prev => [...prev, subj.id]);
                                } else {
                                  setSelectedSubjectIds(prev => prev.filter(id => id !== subj.id));
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">{subj.name}</td>
                          <td className="py-3.5 px-4 font-mono text-blue-600 font-semibold">{subj.code}</td>
                          <td className="py-3.5 px-4 text-slate-300">{subj.department_name || 'N/A'}</td>
                          <td className="py-3.5 px-4 text-slate-400">{subj.program_name || 'UG'}</td>
                          <td className="py-3.5 px-4 text-slate-400">{subj.year_name || '-'}</td>
                          <td className="py-3.5 px-4 text-slate-400">{subj.semester_name || '-'}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${subj.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-200'
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
                                setSubjectFormProgId(subj.program_id || '');
                                setSubjectFormYearId(subj.academic_year_id || '');
                                setSubjectFormSemId(subj.semester_id || '');
                                setShowAddSubjectModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleSubjectStatus(subj)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${subj.is_active
                                  ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                                  : 'text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                              title={subj.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            {currentUser?.role !== 'faculty' && (
                              <button
                                onClick={() => openDeleteSubjectModal(subj)}
                                disabled={currentUser?.role === 'hod' && subj.department_id !== currentUser.department_id}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  currentUser?.role === 'hod' && subj.department_id !== currentUser.department_id
                                    ? 'text-slate-600 cursor-not-allowed opacity-30'
                                    : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                                }`}
                                title={
                                  currentUser?.role === 'hod' && subj.department_id !== currentUser.department_id
                                    ? "Cannot delete subjects from other departments"
                                    : "Delete Subject Safely"
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

        {/* 5. QUESTION BANK TAB */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <span>Question Bank Management</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Total Questions: {questions.length} | Subject-Specific & Department Mapped
                </p>
                <div className="flex items-center space-x-2 mt-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    Total: {questions.length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    Active: {questions.filter(q => q.is_active).length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                    Inactive: {questions.filter(q => !q.is_active).length}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {selectedQuestionIds.length > 0 && (
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'questions',
                        ids: selectedQuestionIds,
                        title: `Bulk Delete ${selectedQuestionIds.length} Question(s)`,
                        description: `Permanently delete ${selectedQuestionIds.length} selected questions from the question bank.`,
                        itemCount: selectedQuestionIds.length,
                        impactDetails: 'Questions linked to student exam attempts will be safely blocked by atomic backend dependency verification to preserve assessment history.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected ({selectedQuestionIds.length})</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setQuestionImportFile(null);
                    setQuestionImportPreview(null);
                    setQuestionImportSubjectId(questionSubjectFilter ? Number(questionSubjectFilter) : '');
                    setShowQuestionImportModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Import PDF / Excel</span>
                </button>
                <button
                  onClick={openAddQuestionModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Question</span>
                </button>
              </div>
            </div>

            {/* Selection Banner if questions are checked */}
            {selectedQuestionIds.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="font-bold">
                    {selectedQuestionIds.length} question{selectedQuestionIds.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {filteredQuestions.length > selectedQuestionIds.length && (
                    <button
                      onClick={() => {
                        const allFilteredIds = filteredQuestions.map(q => q.id);
                        setSelectedQuestionIds(Array.from(new Set([...selectedQuestionIds, ...allFilteredIds])));
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      Select All Matching ({filteredQuestions.length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'questions',
                        ids: selectedQuestionIds,
                        title: `Bulk Delete ${selectedQuestionIds.length} Question(s)`,
                        description: `Permanently delete ${selectedQuestionIds.length} selected questions from the question bank.`,
                        itemCount: selectedQuestionIds.length,
                        impactDetails: 'Questions linked to student exam attempts will be safely blocked by atomic backend dependency verification to preserve assessment history.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedQuestionIds.length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedQuestionIds([])}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search question text or topic..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={questionDeptFilter}
                onChange={(e) => setQuestionDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id.toString()}>{d.name}</option>
                ))}
              </select>

              <select
                value={questionSubjectFilter}
                onChange={(e) => setQuestionSubjectFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id.toString()}>{s.name}</option>
                ))}
              </select>

              <select
                value={questionStatusFilter}
                onChange={(e) => setQuestionStatusFilter(e.target.value as any)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Questions Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestionIds.includes(q.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const ids = filteredQuestions.map(q => q.id);
                              setSelectedQuestionIds(prev => Array.from(new Set([...prev, ...ids])));
                            } else {
                              const idsSet = new Set(filteredQuestions.map(q => q.id));
                              setSelectedQuestionIds(prev => prev.filter(id => !idsSet.has(id)));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Select all matching questions on this page"
                        />
                      </th>
                      <th className="py-3.5 px-4 w-12">#</th>
                      <th className="py-3.5 px-4">Question Text</th>
                      <th className="py-3.5 px-4">Subject / Topic</th>
                      <th className="py-3.5 px-4">Correct</th>
                      <th className="py-3.5 px-4">Difficulty</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredQuestions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No matching questions found in question bank.
                        </td>
                      </tr>
                    ) : (
                      filteredQuestions.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <input
                              type="checkbox"
                              checked={selectedQuestionIds.includes(q.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedQuestionIds(prev => [...prev, q.id]);
                                } else {
                                  setSelectedQuestionIds(prev => prev.filter(id => id !== q.id));
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">{q.id}</td>
                          <td className="py-3.5 px-4 max-w-md">
                            <p className="font-medium text-slate-900 line-clamp-2">{q.question_text}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            <span className="font-semibold text-slate-800 block">{q.subject_name || 'General DSA'}</span>
                            <span className="text-[11px] text-slate-500">{q.topic || 'DSA'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">{q.correct_answer}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {q.difficulty || 'Medium'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${q.is_active
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}>
                              {q.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingQuestion(q);
                                setQFormText(q.question_text);
                                setQFormOptA(q.option_a);
                                setQFormOptB(q.option_b);
                                setQFormOptC(q.option_c);
                                setQFormOptD(q.option_d);
                                setQFormCorrect(q.correct_answer);
                                setQFormTopic(q.topic || 'Data Structures');
                                setQFormDifficulty(q.difficulty || 'Medium');
                                setQFormMarks(q.marks || 1);
                                setQFormDeptId(q.department_id || '');
                                setQFormSubjectId(q.subject_id || '');
                                setShowAddQuestionModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleQuestionStatus(q)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${q.is_active
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              title={q.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDeleteQuestionModal(q)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Question Safely"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

        {/* 6. EXAM MANAGEMENT TAB */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <span>Examination Management & Student Assignment</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Configure department examinations and grant student-specific access authorization.
                </p>
                <div className="flex items-center space-x-2 mt-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    Total: {exams.length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    Published: {exams.filter(e => e.status === 'published').length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                    Draft: {exams.filter(e => e.status === 'draft').length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                    Archived: {exams.filter(e => e.status === 'archived').length}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {selectedExamIds.length > 0 && (
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'exams',
                        ids: selectedExamIds,
                        title: `Bulk Delete ${selectedExamIds.length} Examination(s)`,
                        description: `Permanently delete ${selectedExamIds.length} selected examinations from the system.`,
                        itemCount: selectedExamIds.length,
                        impactDetails: 'Examinations that contain completed student attempts or marks will be safely blocked by atomic backend dependency verification to preserve academic history.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected ({selectedExamIds.length})</span>
                  </button>
                )}
                <button
                  onClick={openCreateExamModal}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create Examination</span>
                </button>
              </div>
            </div>

            {/* Selection Banner if exams are checked */}
            {selectedExamIds.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="font-bold">
                    {selectedExamIds.length} examination{selectedExamIds.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {filteredExams.length > selectedExamIds.length && (
                    <button
                      onClick={() => {
                        const allFilteredIds = filteredExams.map(e => e.id);
                        setSelectedExamIds(Array.from(new Set([...selectedExamIds, ...allFilteredIds])));
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      Select All Matching ({filteredExams.length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'exams',
                        ids: selectedExamIds,
                        title: `Bulk Delete ${selectedExamIds.length} Examination(s)`,
                        description: `Permanently delete ${selectedExamIds.length} selected examinations from the system.`,
                        itemCount: selectedExamIds.length,
                        impactDetails: 'Examinations that contain completed student attempts or marks will be safely blocked by atomic backend dependency verification to preserve academic history.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedExamIds.length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedExamIds([])}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Exam Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search examinations..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={examStatusFilter}
                onChange={(e) => setExamStatusFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Exams Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={filteredExams.length > 0 && filteredExams.every(ex => selectedExamIds.includes(ex.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const ids = filteredExams.map(ex => ex.id);
                              setSelectedExamIds(prev => Array.from(new Set([...prev, ...ids])));
                            } else {
                              const idsSet = new Set(filteredExams.map(ex => ex.id));
                              setSelectedExamIds(prev => prev.filter(id => !idsSet.has(id)));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Select all matching exams on this page"
                        />
                      </th>
                      <th className="py-3.5 px-4">Exam Title</th>
                      <th className="py-3.5 px-4">Subject</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Duration & Qs</th>
                      <th className="py-3.5 px-4">Assigned Students</th>
                      <th className="py-3.5 px-4">Attempts</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredExams.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          No examinations found matching your filter criteria. Click "+ Create Examination" to configure a new test.
                        </td>
                      </tr>
                    ) : (
                      filteredExams.map((ex) => (
                        <tr key={ex.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <input
                              type="checkbox"
                              checked={selectedExamIds.includes(ex.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExamIds(prev => [...prev, ex.id]);
                                } else {
                                  setSelectedExamIds(prev => prev.filter(id => id !== ex.id));
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{ex.title}</span>
                            <span className="text-[11px] text-slate-500 font-mono">Code: {ex.code || `EXAM-${ex.id}`}</span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-700">{ex.subject_name || 'General'}</td>
                          <td className="py-3.5 px-4 text-slate-600">{ex.department_name || 'All'}</td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {ex.duration_minutes} Mins • {ex.total_questions} Questions
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 bg-sky-500/10 border border-blue-200 text-blue-600 font-bold rounded-lg">
                              {ex.assigned_students_count || 0} Students
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{ex.attempts_count || 0}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                              ex.status === 'published'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : ex.status === 'draft'
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : ex.status === 'archived'
                                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }`}>
                              {ex.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button onClick={() => void openEditExamModal(ex)} title="Edit Examination" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center cursor-pointer">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openAssignModal(ex)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1 cursor-pointer"
                              title="Assign Students to Exam"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Assign</span>
                            </button>
                            <button
                              onClick={() => handleRotateSessionCode(ex)}
                              className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1"
                              title="Generate a new one-time session code and invalidate the previous code"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>{ex.has_session_code ? 'New Code' : 'Create Code'}</span>
                            </button>
                            <button
                              onClick={() => handleToggleExamStatus(ex, ex.status === 'published' ? 'closed' : 'published')}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center cursor-pointer"
                              title={ex.status === 'published' ? 'Close Exam' : 'Publish Exam'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            {ex.status === 'archived' ? (
                              <button
                                onClick={() => handleUnarchiveExam(ex)}
                                className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors inline-flex items-center cursor-pointer"
                                title="Unarchive Exam (Restore to Draft)"
                              >
                                <ArchiveRestore className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenArchiveExam(ex)}
                                className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center cursor-pointer"
                                title="Archive Exam (Preserves all attempts & scores)"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenDeleteExam(ex)}
                              className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center cursor-pointer"
                              title="Delete Examination Safely"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

        {/* 7. ASSESSMENT RECORDS TAB */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Student Assessment Records</span>
                </h3>
                <p className="text-xs text-slate-400">Review scores, cheating detection logs, and manage attempt history</p>
                <div className="flex items-center space-x-2 mt-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    Total Records: {studentRecords.length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    Completed: {studentRecords.filter(r => r.status === 'completed').length}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {selectedRecordAttemptIds.length > 0 && (
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'attempts',
                        ids: selectedRecordAttemptIds,
                        title: `Bulk Delete ${selectedRecordAttemptIds.length} Assessment Attempt(s)`,
                        description: `Permanently delete ${selectedRecordAttemptIds.length} selected student assessment attempts and their answer logs.`,
                        itemCount: selectedRecordAttemptIds.length,
                        impactDetails: 'This operation deletes recorded scores, student answers, and security audit logs for the selected attempts. Student profiles and examination definitions remain intact.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected ({selectedRecordAttemptIds.length})</span>
                  </button>
                )}
                <button
                  onClick={handleExportExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel Export</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV Export</span>
                </button>
              </div>
            </div>

            {/* Selection Banner if attempts are checked */}
            {selectedRecordAttemptIds.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="font-bold">
                    {selectedRecordAttemptIds.length} assessment attempt{selectedRecordAttemptIds.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {filteredRecords.filter(r => !!r.attempt_id).length > selectedRecordAttemptIds.length && (
                    <button
                      onClick={() => {
                        const allFilteredIds = filteredRecords.filter(r => !!r.attempt_id).map(r => r.attempt_id as number);
                        setSelectedRecordAttemptIds(Array.from(new Set([...selectedRecordAttemptIds, ...allFilteredIds])));
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      Select All Matching ({filteredRecords.filter(r => !!r.attempt_id).length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'attempts',
                        ids: selectedRecordAttemptIds,
                        title: `Bulk Delete ${selectedRecordAttemptIds.length} Assessment Attempt(s)`,
                        description: `Permanently delete ${selectedRecordAttemptIds.length} selected student assessment attempts and their answer logs.`,
                        itemCount: selectedRecordAttemptIds.length,
                        impactDetails: 'This operation deletes recorded scores, student answers, and security audit logs for the selected attempts. Student profiles and examination definitions remain intact.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedRecordAttemptIds.length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedRecordAttemptIds([])}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search student records..."
                  value={recordsSearch}
                  onChange={(e) => setRecordsSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={recordsDeptFilter}
                onChange={(e) => setRecordsDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Records Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={
                            filteredRecords.filter(r => !!r.attempt_id).length > 0 &&
                            filteredRecords.filter(r => !!r.attempt_id).every(r => selectedRecordAttemptIds.includes(r.attempt_id as number))
                          }
                          onChange={(e) => {
                            const eligible = filteredRecords.filter(r => !!r.attempt_id).map(r => r.attempt_id as number);
                            if (e.target.checked) {
                              setSelectedRecordAttemptIds(prev => Array.from(new Set([...prev, ...eligible])));
                            } else {
                              const eligibleSet = new Set(eligible);
                              setSelectedRecordAttemptIds(prev => prev.filter(id => !eligibleSet.has(id)));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Select all attempts on this page"
                        />
                      </th>
                      <th className="py-3.5 px-4">Student Name & Roll</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Exam / Test</th>
                      <th className="py-3.5 px-4">Score</th>
                      <th className="py-3.5 px-4">Percentage</th>
                      <th className="py-3.5 px-4">Security Audits</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          No student assessment records found.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec) => (
                        <tr key={`${rec.student_id}-${rec.attempt_id || 0}`} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            {rec.attempt_id ? (
                              <input
                                type="checkbox"
                                checked={selectedRecordAttemptIds.includes(rec.attempt_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRecordAttemptIds(prev => [...prev, rec.attempt_id as number]);
                                  } else {
                                    setSelectedRecordAttemptIds(prev => prev.filter(id => id !== rec.attempt_id));
                                  }
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{rec.name}</span>
                            <span className="font-mono text-blue-600 text-[11px]">{rec.enrollment_no}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{rec.department}</td>
                          <td className="py-3.5 px-4 text-slate-600">{rec.exam_title || 'General DSA Assessment'}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{rec.score ?? '-'}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                            {rec.percentage !== null ? `${rec.percentage.toFixed(1)}%` : '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(rec.tab_switch_count || 0) > 0 ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {rec.tab_switch_count || 0} Tab Switches
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${rec.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : rec.status === 'timed_out'
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleInspectAttempt(rec)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Inspect Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {rec.attempt_id && (
                              <button
                                onClick={() => openDeleteAttemptModal(rec)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Attempt Safely"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

        {/* 8. SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            {/* Default Assessment Parameters */}
            <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xl">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-blue-600" />
                  <span>Default Assessment Parameters</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Configure default values for standard assessments. Historical attempt snapshots remain protected.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Number of Questions</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={settingsQuestionCount}
                    onChange={(e) => setSettingsQuestionCount(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Time Limit (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={settingsTimeLimit}
                    onChange={(e) => setSettingsTimeLimit(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    {settingsSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>

            {/* Institutional Staff & Administrator Accounts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <span>Institutional Staff & Administrator Accounts</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Manage Super Admins, HODs, and Faculty accounts. Self-deletion and root admin deletion are permanently blocked.
                  </p>
                </div>

                {selectedUserIds.length > 0 && (
                  <button
                    onClick={() => {
                      setBulkDeleteConfig({
                        type: 'users',
                        ids: selectedUserIds,
                        title: `Bulk Delete ${selectedUserIds.length} Administrator Account(s)`,
                        description: `Permanently delete ${selectedUserIds.length} selected administrator/staff accounts from the system.`,
                        itemCount: selectedUserIds.length,
                        impactDetails: 'Active sessions and primary system administrator accounts cannot be deleted to guarantee system continuity.'
                      });
                      setBulkDeleteConfirmText('');
                    }}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected ({selectedUserIds.length})</span>
                  </button>
                )}
              </div>

              {/* Selection Banner if users are checked */}
              {selectedUserIds.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="font-bold">
                      {selectedUserIds.length} staff account{selectedUserIds.length > 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setBulkDeleteConfig({
                          type: 'users',
                          ids: selectedUserIds,
                          title: `Bulk Delete ${selectedUserIds.length} Administrator Account(s)`,
                          description: `Permanently delete ${selectedUserIds.length} selected administrator/staff accounts from the system.`,
                          itemCount: selectedUserIds.length,
                          impactDetails: 'Active sessions and primary system administrator accounts cannot be deleted to guarantee system continuity.'
                        });
                        setBulkDeleteConfirmText('');
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected ({selectedUserIds.length})</span>
                    </button>
                    <button
                      onClick={() => setSelectedUserIds([])}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              {/* Admin Users Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={adminUsers.length > 0 && adminUsers.every(u => selectedUserIds.includes(u.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds(adminUsers.map(u => u.id));
                              } else {
                                setSelectedUserIds([]);
                              }
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="Select all staff accounts"
                          />
                        </th>
                        <th className="py-3 px-4">Full Name & Username</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Assigned Department</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            No administrative accounts found.
                          </td>
                        </tr>
                      ) : (
                        adminUsers.map((u) => {
                          const isSelf = currentUser?.username === u.username;
                          const isRoot = u.username === 'admin';
                          return (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4">
                                <input
                                  type="checkbox"
                                  disabled={isSelf || isRoot}
                                  checked={selectedUserIds.includes(u.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUserIds(prev => [...prev, u.id]);
                                    } else {
                                      setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-900 block">{u.full_name || u.username}</span>
                                <span className="text-[11px] text-slate-500 font-mono">@{u.username}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  u.role === 'super_admin'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : u.role === 'hod'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {u.role.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">{u.department_name || (u.department_id ? `Dept #${u.department_id}` : 'All Departments')}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  u.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                  {u.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isSelf ? (
                                  <span className="text-[11px] font-semibold text-slate-400 italic">Current Session</span>
                                ) : isRoot ? (
                                  <span className="text-[11px] font-semibold text-slate-400 italic">Protected Root</span>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Administrator Safely"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Database Safety & Verified System Backups */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    <span>Database Safety & Verified System Backups</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Create verified point-in-time snapshots with cryptographic SHA-256 integrity checksums prior to large deletions.
                  </p>
                </div>

                <button
                  onClick={handleCreateBackup}
                  disabled={creatingBackup}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{creatingBackup ? 'Creating Snapshot...' : 'Create Verified Backup Now'}</span>
                </button>
              </div>

              {verifiedBackupResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-emerald-900 shadow-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Cryptographic Integrity Verified Successfully</p>
                    <p className="text-emerald-700">
                      File <span className="font-mono font-semibold">{verifiedBackupResult.filename}</span> matches calculated SHA-256 hash.
                      Total verified records: <span className="font-bold">{verifiedBackupResult.recorded_total_records}</span>.
                    </p>
                    <p className="font-mono text-[10px] text-emerald-600 break-all">
                      SHA256: {verifiedBackupResult.calculated_sha256}
                    </p>
                  </div>
                </div>
              )}

              {/* Backups List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Backup Archive</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-4">Total Records</th>
                        <th className="py-3 px-4">SHA-256 Checksum</th>
                        <th className="py-3 px-4 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {systemBackups.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            No system backups created yet. Click "Create Verified Backup Now" to generate an archive.
                          </td>
                        </tr>
                      ) : (
                        systemBackups.map((b, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.filename}</td>
                            <td className="py-3 px-4 text-slate-600">{new Date(b.created_at).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-600 font-mono">{(b.size_bytes / 1024).toFixed(1)} KB</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{b.total_records} records</td>
                            <td className="py-3 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate" title={b.sha256}>
                              {b.sha256 ? `${b.sha256.substring(0, 16)}...` : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleVerifyBackup(b.filename)}
                                disabled={verifyingBackupFilename === b.filename}
                                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {verifyingBackupFilename === b.filename ? 'Verifying...' : 'Verify Integrity'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 9. EXPORTS TAB */}
        {activeTab === 'exports' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Download className="w-5 h-5 text-blue-600" />
                <span>Institutional Examination Reports</span>
              </h3>
              <p className="text-xs text-slate-400">Download formatted reports with scores, percentages, and cheating audit statistics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Full Assessment Export (Excel)</h4>
                    <p className="text-xs text-slate-400">Standard formatted .xlsx workbook with student scores and percentages</p>
                  </div>
                </div>
                <button
                  onClick={handleExportExcel}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Download Excel Workbook (.xlsx)
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Tabular CSV Export</h4>
                    <p className="text-xs text-slate-400">Raw tabular data suitable for statistical processing</p>
                  </div>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors border border-slate-200"
                >
                  Download CSV (.csv)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL 1: ADD DEPARTMENT (SECTION 3 - ONLY FULL NAME)      */}
      {/* ========================================================= */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Building className="w-5 h-5 text-blue-600" />
                <span>+ Add Department</span>
              </h4>
              <button onClick={() => setShowAddDeptModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDepartment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Department Full Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Computer Science & Engineering"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-xs placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deptCreating}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
                >
                  {deptCreating ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT SUBJECT (SECTIONS 5, 11, 12, 13)       */}
      {/* ========================================================= */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>{editingSubject ? 'Edit Subject' : '+ Add Subject (Manual)'}</span>
              </h4>
              <button onClick={() => setShowAddSubjectModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures"
                  value={subjectFormName}
                  onChange={(e) => setSubjectFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subject Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS301"
                  value={subjectFormCode}
                  onChange={(e) => setSubjectFormCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium font-mono placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">Department *</label>
                  {currentUser?.role === 'hod' && (
                    <span className="text-amber-600 text-[10px] flex items-center gap-1 font-semibold">
                      <Lock className="w-2.5 h-2.5" /> Locked to {currentUser.department_name || 'your department'}
                    </span>
                  )}
                </div>
                <select
                  required
                  disabled={currentUser?.role === 'hod'}
                  value={subjectFormDeptId}
                  onChange={(e) => setSubjectFormDeptId(e.target.value ? Number(e.target.value) : '')}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 ${
                    currentUser?.role === 'hod' ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">Select Department...</option>
                  {departments.length === 0 ? (
                    <option disabled value="">No departments available</option>
                  ) : (
                    departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Dependent Academic Selection: Program -> Year -> Semester */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Program</label>
                  <select
                    value={subjectFormProgId}
                    onChange={(e) => {
                      const newPId = e.target.value ? Number(e.target.value) : '';
                      setSubjectFormProgId(newPId);
                      const validYears = getFilteredYears(newPId);
                      const defaultYear = validYears.length > 0 ? validYears[0].id : '';
                      setSubjectFormYearId(defaultYear);
                      const validSems = getFilteredSemesters(defaultYear, newPId);
                      setSubjectFormSemId(validSems.length > 0 ? validSems[0].id : '');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Select Program...</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Year</label>
                  <select
                    value={subjectFormYearId}
                    onChange={(e) => {
                      const newYId = e.target.value ? Number(e.target.value) : '';
                      setSubjectFormYearId(newYId);
                      const validSems = getFilteredSemesters(newYId, subjectFormProgId);
                      setSubjectFormSemId(validSems.length > 0 ? validSems[0].id : '');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Select Year...</option>
                    {getFilteredYears(subjectFormProgId).map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <select
                    value={subjectFormSemId}
                    onChange={(e) => setSubjectFormSemId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Select Sem...</option>
                    {getFilteredSemesters(subjectFormYearId, subjectFormProgId).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                >
                  {editingSubject ? 'Update Subject' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD / EDIT STUDENT (SECTIONS 7, 8, 9)            */}
      {/* ========================================================= */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>{editingStudent ? 'Edit Student' : '+ Add Enrolled Student'}</span>
              </h4>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Roll / Enrollment No *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BT26F05F001"
                  value={stFormEnrollment}
                  onChange={(e) => setStFormEnrollment(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium font-mono placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Mercer"
                  value={stFormName}
                  onChange={(e) => setStFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">Department *</label>
                    {currentUser?.role === 'hod' && (
                      <span className="text-amber-600 text-[10px] flex items-center gap-1 font-semibold">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>
                  <select
                    required
                    disabled={currentUser?.role === 'hod'}
                    value={stFormDept}
                    onChange={(e) => setStFormDept(e.target.value)}
                    className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 ${
                      currentUser?.role === 'hod' ? 'opacity-80 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Gender</label>
                  <select
                    value={stFormGender}
                    onChange={(e) => setStFormGender(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Dependent Program, Year, Semester */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Program</label>
                  <select
                    value={stFormProg}
                    onChange={(e) => {
                      const newProg = e.target.value;
                      setStFormProg(newProg);
                      const defaultYear = newProg === 'UG' ? '1st Year' : 'M.Tech 1st Year';
                      setStFormYear(defaultYear);
                      setStFormSem('Semester 1');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="UG">UG (B.Tech)</option>
                    <option value="M.Tech">M.Tech</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Year</label>
                  <select
                    value={stFormYear}
                    onChange={(e) => {
                      const newYear = e.target.value;
                      setStFormYear(newYear);
                      const sems = getStudentSemestersForYear(stFormProg, newYear);
                      setStFormSem(sems[0]);
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    {stFormProg === 'UG' ? (
                      <>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="Final Year">Final Year</option>
                      </>
                    ) : (
                      <>
                        <option value="M.Tech 1st Year">M.Tech 1st Year</option>
                        <option value="M.Tech 2nd Year">M.Tech 2nd Year</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <select
                    value={stFormSem}
                    onChange={(e) => setStFormSem(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    {getStudentSemestersForYear(stFormProg, stFormYear).map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Password or Secure PIN</label>
                <input
                  type="password"
                  required={!editingStudent}
                  minLength={8}
                  placeholder={editingStudent ? 'Leave blank to keep current password' : 'At least 8 characters'}
                  value={stFormPassword}
                  onChange={(e) => setStFormPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                >
                  {editingStudent ? 'Save Changes' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: BULK IMPORT STUDENTS                             */}
      {/* ========================================================= */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <UploadCloud className="w-5 h-5 text-emerald-400" />
                <span>Bulk Student Roll-List Import</span>
              </h4>
              <button onClick={() => setShowBulkImportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkImportStudents} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Select target academic group and upload student roll list file (<span className="text-slate-900 font-semibold">CSV, Excel XLSX, or PDF roll-list</span>).
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">Target Department *</label>
                  {currentUser?.role === 'hod' && (
                    <span className="text-amber-600 text-[10px] flex items-center gap-1 font-semibold">
                      <Lock className="w-2.5 h-2.5" /> Locked to {currentUser.department_name || 'your department'}
                    </span>
                  )}
                </div>
                <select
                  required
                  disabled={currentUser?.role === 'hod'}
                  value={importDept}
                  onChange={(e) => setImportDept(e.target.value)}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 ${
                    currentUser?.role === 'hod' ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Program</label>
                  <select
                    value={importProg}
                    onChange={(e) => {
                      setImportProg(e.target.value);
                      setImportYear(e.target.value === 'UG' ? '1st Year' : 'M.Tech 1st Year');
                      setImportSem('Semester 1');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="UG">UG</option>
                    <option value="M.Tech">M.Tech</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Year</label>
                  <select
                    value={importYear}
                    onChange={(e) => {
                      setImportYear(e.target.value);
                      const sems = getStudentSemestersForYear(importProg, e.target.value);
                      setImportSem(sems[0]);
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    {importProg === 'UG' ? (
                      <>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="Final Year">Final Year</option>
                      </>
                    ) : (
                      <>
                        <option value="M.Tech 1st Year">M.Tech 1st Year</option>
                        <option value="M.Tech 2nd Year">M.Tech 2nd Year</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <select
                    value={importSem}
                    onChange={(e) => setImportSem(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    {getStudentSemestersForYear(importProg, importYear).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Upload File (CSV, XLSX, or PDF) *</label>
                <input
                  type="file"
                  required
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold"
                >
                  {importLoading ? 'Importing Roll-List...' : 'Import Students'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DOWNLOAD STUDENT DATA (EXCEL & CSV)                */}
      {/* ========================================================= */}
      {showExportOptionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Download className="w-5 h-5 text-emerald-600" />
                <span>Download Student Assessment Data</span>
              </h4>
              <button
                onClick={() => setShowExportOptionsModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Download institutional student assessment records including enrollment details, exam titles, marks obtained, percentages, and pass/fail statuses.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-[11px]">
                <p className="font-semibold text-slate-800">Fields included in export:</p>
                <p className="text-slate-500">
                  Student Name • Enrollment Number • Department • Program • Year • Semester • Exam Name • Marks Obtained • Total Marks • Percentage • Result • Exam Completion Date
                </p>
                <p className="text-slate-400 text-[10px] pt-1">
                  * Each completed attempt is listed on an individual row. Students without completed attempts include enrollment details with blank result fields.
                </p>
              </div>

              {studentDeptFilter && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-[11px] text-blue-800">
                  Filtering by: <span className="font-bold">{studentDeptFilter}</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => {
                  handleDownloadStudentData('xlsx');
                  setShowExportOptionsModal(false);
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Excel Workbook (.xlsx)</span>
              </button>

              <button
                onClick={() => {
                  handleDownloadStudentData('csv');
                  setShowExportOptionsModal(false);
                }}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Tabular CSV (.csv)</span>
              </button>

              <button
                onClick={() => setShowExportOptionsModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SAFE STUDENT DELETION CONFIRMATION                 */}
      {/* ========================================================= */}
      {showDeleteStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-base font-bold text-slate-900">
                  {studentToDelete
                    ? `Confirm Deletion: ${studentToDelete.name} (${studentToDelete.enrollment_no})`
                    : `Confirm Student Deletion (${selectedStudentIds.length} Student${selectedStudentIds.length > 1 ? 's' : ''})`
                  }
                </h4>
              </div>
              <button
                onClick={() => {
                  setShowDeleteStudentModal(false);
                  setStudentToDelete(null);
                }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-700">
                You are requesting to permanently delete <strong className="text-rose-600 font-bold">{selectedStudentIds.length}</strong> student record{selectedStudentIds.length > 1 ? 's' : ''}:
              </p>

              {/* Student(s) Summary List */}
              <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                {studentsList
                  .filter(st => selectedStudentIds.includes(st.id))
                  .map(st => (
                    <div key={st.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0">
                      <div>
                        <span className="font-bold text-slate-900">{st.name}</span>
                        <span className="text-slate-500 font-mono text-[11px] ml-2">({st.enrollment_no})</span>
                      </div>
                      <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-semibold">
                        {st.department}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Data Retention & Impact Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 text-amber-900 text-[11px]">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Retention Rules & Integrity Protection</span>
                </p>
                <p className="leading-relaxed">
                  Deleting these student records will safely remove their student profile, active & historical examination attempts, submitted answer records, security logs, and exam assignment mappings.
                </p>
                <p className="text-amber-800 font-medium pt-1">
                  ✓ Unrelated students, question banks, subjects, examinations, departments, and system configurations are fully preserved.
                </p>
              </div>

              {/* Recommended & Required Backup Download Step */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-emerald-800 font-bold">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Recommended & Required: Export Backup Before Deletion</span>
                </div>
                <p className="text-emerald-700 text-[11px] leading-relaxed">
                  Download an official backup copy of these students and their assessment results before completing the deletion.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadStudentData('xlsx', selectedStudentIds)}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1 shadow-xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Download Backup (Excel)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadStudentData('csv', selectedStudentIds)}
                    className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1 shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Backup (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start space-x-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteConfirmedBackup}
                  onChange={(e) => setDeleteConfirmedBackup(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-slate-700 text-[11px] leading-snug">
                  I confirm that I have reviewed the student records, downloaded or verified backup exports, and authorize permanent deletion of the selected {selectedStudentIds.length} student record{selectedStudentIds.length > 1 ? 's' : ''}.
                </span>
              </label>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteStudentModal(false);
                  setStudentToDelete(null);
                  setDeleteConfirmedBackup(false);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!deleteConfirmedBackup || deletingStudents}
                onClick={handleConfirmDeleteStudents}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingStudents ? 'Deleting...' : `Confirm & Delete (${selectedStudentIds.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: CREATE / EDIT EXAMINATION (SECTIONS 17-22)       */}
      {/* ========================================================= */}
      {showCreateExamModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                <span>{editingExam ? 'Edit Examination' : '+ Create New Examination'}</span>
              </h4>
              <button onClick={() => setShowCreateExamModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Exam Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures Midterm Test"
                  value={examFormTitle}
                  onChange={(e) => setExamFormTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Department First per Section 18 & 19 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">Department *</label>
                  {currentUser?.role === 'hod' && (
                    <span className="text-amber-600 text-[10px] flex items-center gap-1 font-semibold">
                      <Lock className="w-2.5 h-2.5" /> Locked to {currentUser.department_name || 'your department'}
                    </span>
                  )}
                </div>
                <select
                  required
                  disabled={currentUser?.role === 'hod'}
                  value={examFormDeptId}
                  onChange={(e) => handleExamDeptChange(e.target.value ? Number(e.target.value) : '')}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 ${
                    currentUser?.role === 'hod' ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Program, Year, Semester Hierarchy for Subject Filtering */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Program</label>
                  <select
                    value={examFormProgId}
                    onChange={(e) => {
                      const newPId = e.target.value ? Number(e.target.value) : '';
                      setExamFormProgId(newPId);
                      const validYears = getFilteredYears(newPId);
                      const defaultYear = validYears.length > 0 ? validYears[0].id : '';
                      setExamFormYearId(defaultYear);
                      const validSems = getFilteredSemesters(defaultYear, newPId);
                      setExamFormSemId(validSems.length > 0 ? validSems[0].id : '');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All Programs</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Year</label>
                  <select
                    value={examFormYearId}
                    onChange={(e) => {
                      const newYId = e.target.value ? Number(e.target.value) : '';
                      setExamFormYearId(newYId);
                      const validSems = getFilteredSemesters(newYId, examFormProgId);
                      setExamFormSemId(validSems.length > 0 ? validSems[0].id : '');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All Years</option>
                    {getFilteredYears(examFormProgId).map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <select
                    value={examFormSemId}
                    onChange={(e) => setExamFormSemId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-[11px] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">All Semesters</option>
                    {getFilteredSemesters(examFormYearId, examFormProgId).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Selection strictly filtered by Department per Section 19 & 20 */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subject Association *</label>
                <select
                  required
                  value={examFormSubjectId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : '';
                    setExamFormSubjectId(id);
                    setExamSelectedQuestionIds([]);
                    const subject = subjects.find(item => item.id === id);
                    if (subject) {
                      setExamFormProgId(subject.program_id || '');
                      setExamFormYearId(subject.academic_year_id || '');
                      setExamFormSemId(subject.semester_id || '');
                    }
                  }}
                  disabled={!examFormDeptId}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!examFormDeptId ? 'Please select a department above first...' : 'Select Subject...'}
                  </option>
                  {displayExamSubjects.length === 0 && examFormDeptId ? (
                    <option disabled value="">
                      No active subjects found for this department. Please add a subject first.
                    </option>
                  ) : (
                    displayExamSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) {s.department_name ? `• ${s.department_name}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {examFormSubjectId && (
                <p className={`text-xs ${examBankQuestions.length < examFormQuestionsCount ? 'text-amber-700' : 'text-slate-600'}`}>
                  {examBankQuestions.length} active questions available for this subject.
                  {examBankQuestions.length < examFormQuestionsCount && ' Add or import questions, or reduce the question count.'}
                </p>
              )}
              {/* Duration, Questions, Marks, Pass % */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormDuration}
                    onChange={(e) => setExamFormDuration(parseInt(e.target.value, 10) || 60)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Questions</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormQuestionsCount}
                    onChange={(e) => setExamFormQuestionsCount(parseInt(e.target.value, 10) || 25)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Marks/Q</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormMarksPerQ}
                    onChange={(e) => setExamFormMarksPerQ(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Pass %</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={examFormPassingPct}
                    onChange={(e) => setExamFormPassingPct(parseFloat(e.target.value) || 40)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Question Selection Mode</label>
                  <select
                    value={examFormSelectionMode}
                    onChange={(e) => setExamFormSelectionMode(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="random">Random from Subject Bank</option>
                    <option value="manual">Manual Selection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Status</label>
                  <select
                    value={examFormStatus}
                    onChange={(e) => setExamFormStatus(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="published">Published (Available)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {examFormSelectionMode === 'manual' && (
                <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                  <p className="font-bold text-slate-700 sticky top-0 bg-white pb-1">Select {examFormQuestionsCount} questions ({examSelectedQuestionIds.length} selected)</p>
                  {examBankQuestions.map(question => (
                    <label key={question.id} className="flex items-start gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={examSelectedQuestionIds.includes(question.id)}
                        onChange={(event) => setExamSelectedQuestionIds(previous => event.target.checked ? [...previous, question.id] : previous.filter(id => id !== question.id))}
                      />
                      <span>{question.question_text}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Date (Optional)</label>
                  <input
                    type="date"
                    value={examFormStartDate}
                    onChange={(e) => setExamFormStartDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Time</label>
                  <input type="time" value={examFormStartTime} onChange={(e) => setExamFormStartTime(e.target.value)} disabled={!examFormStartDate} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={examFormEndDate}
                    onChange={(e) => setExamFormEndDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Time</label>
                  <input type="time" value={examFormEndTime} onChange={(e) => setExamFormEndTime(e.target.value)} disabled={!examFormEndDate} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900" />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Release question review</label>
                <select value={examFormResultRelease} onChange={(e) => setExamFormResultRelease(e.target.value as 'immediate' | 'after_close')} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900">
                  <option value="after_close">After exam closes (recommended)</option>
                  <option value="immediate">Immediately after submission</option>
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={examSaving}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold"
                >
                  {examSaving ? 'Saving…' : editingExam ? 'Save Changes' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: ASSIGN STUDENTS TO EXAM (SECTIONS 13, 16)        */}
      {/* ========================================================= */}
      {assigningExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <span>Assign Students to: {assigningExam.title}</span>
                </h4>
                <p className="text-xs text-slate-400">
                  CRITICAL: Only selected students will have backend authorization to see and take this exam.
                </p>
              </div>
              <button onClick={() => setAssigningExam(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <select
                value={assignFilterDept}
                onChange={(e) => setAssignFilterDept(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                  className="px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-blue-600 border border-blue-200 rounded-lg font-bold"
                >
                  Select All Filtered
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIdsToAssign([])}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-semibold transition-colors"
                >
                  Clear All
                </button>
                <span className="text-slate-600 font-bold ml-2">
                  {selectedStudentIdsToAssign.length} Selected (Previously Assigned: {assignedStudents.length})
                </span>
              </div>
            </div>

            {/* Students Selection List */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white text-xs">
              {studentsList
                .filter(st => {
                  const matchSearch = !assignSearch || st.enrollment_no.toLowerCase().includes(assignSearch.toLowerCase()) || st.name.toLowerCase().includes(assignSearch.toLowerCase());
                  const matchDept = !assignFilterDept || st.department === assignFilterDept;
                  return matchSearch && matchDept;
                })
                .map(st => {
                  const isChecked = selectedStudentIdsToAssign.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isChecked ? 'bg-sky-50' : 'hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIdsToAssign(prev => [...prev, st.id]);
                            } else {
                              setSelectedStudentIdsToAssign(prev => prev.filter(id => id !== st.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-0"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{st.name}</p>
                          <p className="text-[11px] font-mono text-blue-600">{st.enrollment_no}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-600 font-medium">{st.department}</p>
                        <p className="text-[11px] text-slate-500">{st.year || '1st Year'} • {st.semester || 'Sem 1'}</p>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAssigningExam(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStudentAssignments}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
              >
                Save Exam Assignments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: ADD / EDIT QUESTION                              */}
      {/* ========================================================= */}
      {showQuestionImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Import reviewed MCQ questions</h3>
                <p className="text-xs text-slate-500 mt-1">PDF import recognizes common question layouts, A–D or 1–4 choices, inline answers and separate answer keys. Scanned PDFs need OCR installed on the backend. Review the preview carefully before confirming.</p>
              </div>
              <button onClick={() => setShowQuestionImportModal(false)} className="p-2 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <select
              value={questionImportSubjectId}
              onChange={(event) => { setQuestionImportSubjectId(event.target.value ? Number(event.target.value) : ''); setQuestionImportPreview(null); }}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm"
            >
              <option value="">Select target subject…</option>
              {subjects.filter(subject => subject.is_active).map(subject => <option key={subject.id} value={subject.id}>{subject.name} — {subject.department_name}</option>)}
            </select>
            <input
              type="file"
              accept=".csv,.xlsx,.pdf"
              onChange={(event) => { setQuestionImportFile(event.target.files?.[0] || null); setQuestionImportPreview(null); }}
              className="w-full p-3 border border-dashed border-slate-300 rounded-xl text-sm"
            />
            {questionImportPreview && (
              <div className={`rounded-xl border p-4 text-xs ${questionImportPreview.error_count ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className="font-bold">{questionImportPreview.valid_count} valid question(s), {questionImportPreview.error_count} error(s)</p>
                {questionImportPreview.errors?.slice(0, 8).map((error: string) => <p key={error} className="mt-1 text-rose-700">{error}</p>)}
                {questionImportPreview.questions?.slice(0, 3).map((question: any) => <p key={`${question.source_row}-${question.question_text}`} className="mt-2 text-slate-700"><strong>Preview:</strong> {question.question_text}</p>)}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowQuestionImportModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold">Cancel</button>
              <button onClick={() => handleQuestionImport(true)} disabled={questionImportLoading} className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">Preview</button>
              <button onClick={() => handleQuestionImport(false)} disabled={questionImportLoading || !questionImportPreview?.can_commit} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">Confirm import</button>
            </div>
          </div>
        </div>
      )}

      {sessionCodeDisplay && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 text-center">
            <Lock className="w-8 h-8 text-violet-600 mx-auto" />
            <div>
              <h3 className="font-bold text-slate-900">New code for {sessionCodeDisplay.examTitle}</h3>
              <p className="text-xs text-amber-700 mt-1">This code is shown only once. The previous code no longer works.</p>
            </div>
            <div className="text-3xl tracking-[0.35em] font-black font-mono bg-slate-100 border border-slate-200 rounded-xl p-4">{sessionCodeDisplay.code}</div>
            <button
              onClick={() => navigator.clipboard.writeText(sessionCodeDisplay.code)}
              className="w-full py-2.5 border border-violet-300 text-violet-700 rounded-xl font-bold"
            >Copy code</button>
            <button onClick={() => setSessionCodeDisplay(null)} className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-bold">I stored it securely</button>
          </div>
        </div>
      )}

      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>{editingQuestion ? 'Edit Question' : '+ Add Question to Question Bank'}</span>
              </h4>
              <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Subject Association</label>
                  <select
                    value={qFormSubjectId}
                    onChange={(e) => {
                      const sId = e.target.value ? Number(e.target.value) : '';
                      setQFormSubjectId(sId);
                      const sObj = subjects.find(s => s.id === sId);
                      if (sObj && sObj.department_id) {
                        setQFormDeptId(sObj.department_id);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">General (No specific subject)</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">Department</label>
                    {currentUser?.role === 'hod' && (
                      <span className="text-amber-600 text-[10px] flex items-center gap-1 font-semibold">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>
                  <select
                    disabled={currentUser?.role === 'hod'}
                    value={qFormDeptId}
                    onChange={(e) => setQFormDeptId(e.target.value ? Number(e.target.value) : '')}
                    className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 ${
                      currentUser?.role === 'hod' ? 'opacity-80 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Question Text *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Which of the following is a linear data structure?"
                  value={qFormText}
                  onChange={(e) => setQFormText(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Option A *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptA}
                    onChange={(e) => setQFormOptA(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Option B *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptB}
                    onChange={(e) => setQFormOptB(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Option C *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptC}
                    onChange={(e) => setQFormOptC(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Option D *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptD}
                    onChange={(e) => setQFormOptD(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Correct Answer</label>
                  <select
                    value={qFormCorrect}
                    onChange={(e) => setQFormCorrect(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={qFormMarks}
                    onChange={(e) => setQFormMarks(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Difficulty</label>
                  <select
                    value={qFormDifficulty}
                    onChange={(e) => setQFormDifficulty(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Topic</label>
                  <input
                    type="text"
                    value={qFormTopic}
                    onChange={(e) => setQFormTopic(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                >
                  {editingQuestion ? 'Update Question' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 8: DELETE SUBJECT CONFIRMATION                      */}
      {/* ========================================================= */}
      {deletingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-2xl ${subjectDeps?.has_dependencies ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                  {subjectDeps?.has_dependencies ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {subjectDeps?.has_dependencies ? 'Subject Deletion Blocked' : 'Delete Subject'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {subjectDeps?.has_dependencies ? 'Protected dependencies detected' : 'Permanent removal confirmation'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setDeletingSubject(null); setSubjectDeps(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subject Profile Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">{deletingSubject.name}</div>
                  <div className="text-xs font-mono font-semibold text-blue-600 mt-0.5">Code: {deletingSubject.code}</div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  deletingSubject.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {deletingSubject.is_active ? 'Active' : 'Inactive / Archived'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-600 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400">Department:</span>{' '}
                  <span className="font-medium text-slate-800">{deletingSubject.department_name || departments.find(d => d.id === deletingSubject.department_id)?.name || 'General'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Semester:</span>{' '}
                  <span className="font-medium text-slate-800">{deletingSubject.semester_name || '-'}</span>
                </div>
              </div>
            </div>

            {/* Dependency Evaluation Section */}
            {subjectDeps?.loading ? (
              <div className="py-6 flex flex-col items-center justify-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Verifying questions, examinations, and student attempt records...</p>
              </div>
            ) : subjectDeps?.has_dependencies ? (
              /* Case A: Protected Dependencies Exist */
              <div className="space-y-4">
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2.5">
                  <div className="flex items-center space-x-2 font-bold text-amber-800 text-xs uppercase tracking-wide">
                    <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Academic Integrity Protection Active</span>
                  </div>
                  <p className="leading-relaxed text-amber-800/90">
                    Permanent deletion is <strong className="font-semibold text-amber-950">disabled</strong> because this subject is linked to active or historical records:
                  </p>
                  <div className="grid grid-cols-3 gap-2 py-1 text-center font-semibold">
                    <div className="bg-white/90 border border-amber-200/60 rounded-xl p-2 shadow-xs">
                      <div className="text-base text-amber-950 font-black">{subjectDeps.question_count}</div>
                      <div className="text-[10px] text-amber-700">Question(s)</div>
                    </div>
                    <div className="bg-white/90 border border-amber-200/60 rounded-xl p-2 shadow-xs">
                      <div className="text-base text-amber-950 font-black">{subjectDeps.exam_count}</div>
                      <div className="text-[10px] text-amber-700">Exam(s)</div>
                    </div>
                    <div className="bg-white/90 border border-amber-200/60 rounded-xl p-2 shadow-xs">
                      <div className="text-base text-amber-950 font-black">{subjectDeps.attempt_count}</div>
                      <div className="text-[10px] text-amber-700">Student Attempt(s)</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-normal">
                    Permanently deleting this subject would corrupt previous assessment reports, question banks, or grade history. To prevent this subject from appearing in new examinations, use <span className="font-bold">Deactivate / Archive</span> instead.
                  </p>
                </div>

                {/* Actions for Protected Subject */}
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setDeletingSubject(null); setSubjectDeps(null); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  {deletingSubject.is_active ? (
                    <button
                      type="button"
                      disabled={isDeactivatingSubject}
                      onClick={handleDeactivateSubjectFromModal}
                      className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all flex items-center justify-center space-x-1.5"
                    >
                      {isDeactivatingSubject ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Archiving...</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-3.5 h-3.5" />
                          <span>Deactivate & Archive</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 text-center py-2.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-medium border border-slate-200">
                      Already Deactivated
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Case B: Eligible for Permanent Deletion (No Dependencies) */
              <div className="space-y-4">
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-emerald-800 text-xs uppercase tracking-wide">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Eligible for Permanent Deletion</span>
                  </div>
                  <p className="leading-relaxed text-emerald-800/90">
                    This subject has <strong className="font-semibold text-emerald-950">no questions, examinations, or student attempts</strong> referencing it. It can be safely and permanently deleted without affecting any academic history.
                  </p>
                  <p className="text-[11px] text-rose-600 font-semibold">
                    Warning: This action will completely remove this subject from the database and cannot be undone.
                  </p>
                </div>

                {/* Actions for Eligible Subject */}
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    disabled={isDeletingSubject}
                    onClick={() => { setDeletingSubject(null); setSubjectDeps(null); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingSubject}
                    onClick={handleDeleteSubject}
                    className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all flex items-center justify-center space-x-1.5"
                  >
                    {isDeletingSubject ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Permanently Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SAFE DEPARTMENT DELETION                           */}
      {/* ========================================================= */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete Department Safely</h4>
                <p className="text-xs text-slate-500 font-medium">Department: {deptToDelete.name}</p>
              </div>
            </div>

            {checkingDeptDeps ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Checking dependent subjects, exams, and enrolled students...</p>
              </div>
            ) : deptDeps && !deptDeps.can_delete ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2.5">
                  <div className="flex items-center space-x-2 font-bold text-amber-800">
                    <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Department Deletion Blocked by Active Dependencies</span>
                  </div>
                  <p className="leading-relaxed">
                    This department cannot be permanently deleted because active dependent records are mapped to it:
                  </p>
                  <div className="grid grid-cols-3 gap-2 py-1 text-center font-semibold">
                    <div className="bg-white border border-amber-200 rounded-xl p-2">
                      <div className="text-base font-black text-amber-950">{deptDeps.subjects_count || 0}</div>
                      <div className="text-[10px] text-amber-700">Subject(s)</div>
                    </div>
                    <div className="bg-white border border-amber-200 rounded-xl p-2">
                      <div className="text-base font-black text-amber-950">{deptDeps.students_count || 0}</div>
                      <div className="text-[10px] text-amber-700">Student(s)</div>
                    </div>
                    <div className="bg-white border border-amber-200 rounded-xl p-2">
                      <div className="text-base font-black text-amber-950">{deptDeps.exams_count || 0}</div>
                      <div className="text-[10px] text-amber-700">Exam(s)</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    {deptDeps.reason || "Reassign or delete dependent subjects, students, and exams before deleting this department."}
                  </p>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => { setDeptToDelete(null); setDeptDeps(null); }}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Eligible for Permanent Deletion</span>
                  </div>
                  <p>
                    This department has <strong>0 dependent subjects, students, and exams</strong>. Permanent deletion will remove it completely.
                  </p>
                </div>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    disabled={isDeletingDept}
                    onClick={() => { setDeptToDelete(null); setDeptDeps(null); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isDeletingDept}
                    onClick={handleConfirmDeleteDept}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {isDeletingDept ? 'Deleting...' : 'Permanently Delete Department'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SAFE QUESTION DELETION                             */}
      {/* ========================================================= */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <h4 className="text-base font-bold text-slate-900">Safe Question Deletion</h4>
                <p className="text-xs text-slate-500 font-mono">Question #{deletingQuestion.id}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-xs text-slate-700 line-clamp-3">
              "{deletingQuestion.question_text}"
            </div>

            {checkingQuestionDeps ? (
              <div className="py-6 flex flex-col items-center justify-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Checking question examination and student attempt dependencies...</p>
              </div>
            ) : questionDeps && !questionDeps.can_delete ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2.5">
                  <div className="flex items-center space-x-2 font-bold text-amber-800">
                    <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Academic Assessment History Protected</span>
                  </div>
                  <p className="leading-relaxed">
                    This question is referenced by <strong>{questionDeps.answers_count || 0} student exam attempt(s)</strong>.
                    Permanent deletion is blocked to prevent grade corruption. You may <strong>Deactivate</strong> this question so it won't appear in future tests.
                  </p>
                </div>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={() => { setDeletingQuestion(null); setQuestionDeps(null); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeactivateQuestionFromModal}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Deactivate & Archive
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Eligible for Permanent Deletion</span>
                  </div>
                  <p>
                    This question has no completed student examination attempts referencing it and can be permanently deleted safely.
                  </p>
                </div>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    disabled={isDeletingQuestion}
                    onClick={() => { setDeletingQuestion(null); setQuestionDeps(null); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isDeletingQuestion}
                    onClick={handleConfirmDeleteQuestion}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {isDeletingQuestion ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE / SAFE ARCHIVE EXAMINATION                  */}
      {/* ========================================================= */}
      {showExamDeleteModal && examToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            {examToDelete.attempts_count > 0 ? (
              <>
                <div className="flex items-center space-x-3 text-amber-500">
                  <ShieldAlert className="w-6 h-6" />
                  <h4 className="text-base font-bold text-slate-900">Protected Examination</h4>
                </div>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                  <p>
                    Examination <strong className="text-slate-900">{examToDelete.title}</strong> has <strong className="text-amber-600 font-bold">{examToDelete.attempts_count} completed student attempt(s)</strong> and recorded marks.
                  </p>
                  <p className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl font-medium">
                    Permanent deletion is blocked to protect student grades and institutional audit integrity. You can safely <strong>Archive</strong> this examination instead to deactivate it while keeping all historical results intact.
                  </p>
                </div>
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExamDeleteModal(false);
                      setExamToDelete(null);
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={examArchiveLoading}
                    onClick={() => handleConfirmArchiveExam(examToDelete)}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Archive className="w-4 h-4" />
                    <span>{examArchiveLoading ? 'Archiving...' : 'Archive Safely'}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-3 text-rose-500">
                  <AlertTriangle className="w-6 h-6" />
                  <h4 className="text-base font-bold text-slate-900">Delete Examination</h4>
                </div>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                  <p>
                    Are you sure you want to permanently delete <strong className="text-slate-900">{examToDelete.title}</strong>?
                  </p>
                  <p className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-600">
                    This examination has <strong>0 student attempts</strong>. Its question mappings and student assignments will be safely removed.
                  </p>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExamDeleteModal(false);
                      setExamToDelete(null);
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={examArchiveLoading}
                    onClick={() => handleConfirmArchiveExam(examToDelete)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 cursor-pointer"
                    title="Archive without deleting"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                  <button
                    type="button"
                    disabled={examDeleteLoading}
                    onClick={handleConfirmDeleteExam}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{examDeleteLoading ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ARCHIVE EXAMINATION CONFIRMATION                   */}
      {/* ========================================================= */}
      {showExamArchiveModal && examToArchive && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-amber-500">
              <Archive className="w-6 h-6" />
              <h4 className="text-base font-bold text-slate-900">Archive Examination</h4>
            </div>
            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                Archive examination <strong className="text-slate-900">{examToArchive.title}</strong>?
              </p>
              <p className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl font-medium">
                Archiving sets this exam to <strong>Archived</strong> status and prevents new attempts. All existing attempts, student marks, and answer logs will be 100% preserved. You can restore it to draft at any time.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExamArchiveModal(false);
                  setExamToArchive(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={examArchiveLoading}
                onClick={() => handleConfirmArchiveExam(examToArchive)}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Archive className="w-4 h-4" />
                <span>{examArchiveLoading ? 'Archiving...' : 'Confirm Archive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SAFE ATTEMPT DELETION                              */}
      {/* ========================================================= */}
      {deletingAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete Assessment Attempt</h4>
                <p className="text-xs text-slate-500 font-mono">Attempt #{deletingAttempt.attempt_id}</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-xs text-slate-700 space-y-1">
              <p>Student: <strong className="text-slate-900">{deletingAttempt.name}</strong> ({deletingAttempt.enrollment_no})</p>
              <p>Exam: <strong className="text-slate-900">{deletingAttempt.exam_title || 'General'}</strong></p>
              <p>Score: <strong className="text-slate-900">{deletingAttempt.score ?? '-'}</strong></p>
            </div>

            {checkingAttemptDeps ? (
              <div className="py-4 flex items-center justify-center space-x-2 text-xs text-slate-500 bg-slate-50 rounded-xl">
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                <span>Checking dependent records...</span>
              </div>
            ) : attemptDeps && (
              <div className="grid grid-cols-2 gap-2 text-xs text-center font-semibold">
                <div className="bg-slate-100 rounded-xl p-2 border border-slate-200">
                  <div className="text-sm font-bold text-slate-900">{attemptDeps.answers_count || 0}</div>
                  <div className="text-[10px] text-slate-500">Student Answer(s)</div>
                </div>
                <div className="bg-slate-100 rounded-xl p-2 border border-slate-200">
                  <div className="text-sm font-bold text-slate-900">{attemptDeps.logs_count || 0}</div>
                  <div className="text-[10px] text-slate-500">Security Audit Log(s)</div>
                </div>
              </div>
            )}

            <p className="text-xs text-rose-600 leading-relaxed font-semibold">
              Warning: This will permanently delete the attempt record, student question answers, and anti-cheating audit trail. The student profile and exam definition will remain intact.
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <button
                disabled={isDeletingAttempt}
                onClick={() => { setDeletingAttempt(null); setAttemptDeps(null); }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeletingAttempt}
                onClick={handleConfirmDeleteAttempt}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {isDeletingAttempt ? 'Deleting...' : 'Permanently Delete Attempt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: STAFF / ADMIN USER DELETION                        */}
      {/* ========================================================= */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete Administrator Account</h4>
                <p className="text-xs text-slate-500 font-mono">@{deletingUser.username}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete administrative account <strong className="text-slate-900">{deletingUser.full_name || deletingUser.username}</strong> ({deletingUser.role})?
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <button
                disabled={isDeletingUser}
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {isDeletingUser ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: UNIVERSAL HIGH-IMPACT BULK DELETION                */}
      {/* ========================================================= */}
      {bulkDeleteConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">{bulkDeleteConfig.title}</h4>
                <p className="text-xs text-slate-500">Atomic High-Impact Permanent Bulk Deletion</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                {bulkDeleteConfig.description}
              </p>
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl space-y-2 text-rose-900 font-medium">
                <div className="flex items-center justify-between">
                  <span>Selected Record Count:</span>
                  <span className="font-bold font-mono text-sm">{bulkDeleteConfig.itemCount}</span>
                </div>
                {bulkDeleteConfig.impactDetails && (
                  <p className="text-[11px] text-rose-800 leading-normal pt-1 border-t border-rose-200">
                    {bulkDeleteConfig.impactDetails}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 pt-1">
                <label className="block text-slate-700 font-bold">
                  Type <span className="font-mono text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">DELETE</span> to confirm permanent deletion:
                </label>
                <input
                  type="text"
                  value={bulkDeleteConfirmText}
                  onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium font-mono text-sm tracking-wider placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => {
                  setBulkDeleteConfig(null);
                  setBulkDeleteConfirmText('');
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting || bulkDeleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                onClick={handleExecuteBulkDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
              >
                {isBulkDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Bulk Delete...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Permanent Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 11: INSPECT ATTEMPT DETAILS WITH SECURITY LOGS      */}
      {/* ========================================================= */}
      {inspectingAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Assessment Inspection: {inspectingAttempt.student?.name} ({inspectingAttempt.student?.enrollment_no})
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {inspectingAttempt.student?.department} • Score: {inspectingAttempt.attempt?.score ?? 'N/A'}/{inspectingAttempt.attempt?.total_questions ?? 'N/A'} ({inspectingAttempt.attempt?.percentage?.toFixed(1) ?? '0.0'}%)
                </p>
              </div>
              <button onClick={() => setInspectingAttempt(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Anti-Cheating Security Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <h5 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>Cheating Reduction & Audit Trail</span>
              </h5>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">Tab Switches</span>
                  <span className="text-sm font-bold text-amber-400">{inspectingAttempt.attempt?.tab_switch_count || 0}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">Fullscreen Exits</span>
                  <span className="text-sm font-bold text-amber-400">{inspectingAttempt.attempt?.fullscreen_exit_count || 0}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">Copy Attempts</span>
                  <span className="text-sm font-bold text-rose-400">{inspectingAttempt.attempt?.copy_count || 0}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">Paste Attempts</span>
                  <span className="text-sm font-bold text-rose-400">{inspectingAttempt.attempt?.paste_count || 0}</span>
                </div>
              </div>
            </div>

            {/* Student Answers Inspection */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              <h5 className="font-bold text-slate-900">Question-Wise Response Audit:</h5>
              {inspectingAttempt.answers && inspectingAttempt.answers.length > 0 ? (
                inspectingAttempt.answers.map((ans: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600 font-mono">Q{ans.question_number || idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${ans.is_correct ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                        {ans.is_correct ? 'Correct (+1)' : 'Incorrect (0)'}
                      </span>
                    </div>
                    <p className="text-slate-900 font-medium leading-relaxed">{ans.question || ans.question_text}</p>
                    <div className="flex items-center space-x-4 text-[11px] pt-1">
                      <span className="text-slate-600">
                        Selected: <strong className="text-slate-900 font-bold">{ans.selected_answer || 'Unanswered'}</strong>
                      </span>
                      <span className="text-slate-600">
                        Correct: <strong className="text-emerald-700 font-bold">{ans.correct_answer}</strong>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-center py-4">No individual question answer logs found for this attempt.</p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setInspectingAttempt(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
