import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CheckCircle2, LogOut, Download, FileText,
  UserCheck, Search, Eye, HelpCircle, Sliders, Plus, Edit3, Power,
  AlertTriangle, X, Shield, RefreshCw, Trash2, BookOpen,
  GraduationCap, Building, Layers, Calendar, UserPlus,
  UploadCloud, FileSpreadsheet, ShieldAlert, Lock, ArrowRight, ArrowLeft
} from 'lucide-react';
import api, { API_BASE_URL } from '../services/api';
import { CollegeBranding } from '../components/CollegeBranding';
import type {
  AdminStats, StudentSummary, AdminQuestion, AssessmentSettings,
  Department, Program, AcademicYear, Semester, Subject, Exam, AssignedStudent, Student,
  DepartmentStats, AdminUser
} from '../types';

type DashboardTab = 'overview' | 'academic' | 'students' | 'subjects' | 'questions' | 'exams' | 'records' | 'settings' | 'exports';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

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
  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
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

  // Student Form State
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
  const [examFormEndDate, setExamFormEndDate] = useState('');

  // Student Assessment Records State
  const [studentRecords, setStudentRecords] = useState<StudentSummary[]>([]);
  const [recordsSearch, setRecordsSearch] = useState('');
  const [recordsDeptFilter, setRecordsDeptFilter] = useState('');
  const [deletingAttempt, setDeletingAttempt] = useState<StudentSummary | null>(null);
  const [inspectingAttempt, setInspectingAttempt] = useState<any | null>(null);

  // Assessment Settings State
  const [settingsQuestionCount, setSettingsQuestionCount] = useState<number>(50);
  const [settingsTimeLimit, setSettingsTimeLimit] = useState<number>(60);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ==========================================
  // INITIALIZATION & DATA FETCHING
  // ==========================================

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
        setActiveTab('subjects');
      } else if (loadedDepts.length > 0) {
        setImportDept(loadedDepts[0].name);
        setStFormDept(loadedDepts[0].name);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/admin/login');
      } else {
        console.error('Error loading dashboard:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Reload relevant datasets on tab change
  useEffect(() => {
    loadAcademicData();
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
      const res = await api.get<AssessmentSettings>('/admin/assessment-settings');
      setSettingsQuestionCount(res.data.question_count);
      setSettingsTimeLimit(res.data.time_limit_minutes);
    } catch (err) {
      console.error('Failed to load settings', err);
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
    localStorage.removeItem('admin_token');
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

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    try {
      await api.delete(`/subjects/${deletingSubject.id}`);
      showNotice('success', `Subject '${deletingSubject.name}' deleted successfully.`);
      setSubjects(prev => prev.filter(s => s.id !== deletingSubject.id));
      setDeletingSubject(null);
      loadSubjects();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete subject.');
      setDeletingSubject(null);
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
    setStFormPassword('student123');
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

  const handleDeleteQuestion = async () => {
    if (!deletingQuestion) return;
    try {
      await api.delete(`/admin/questions/${deletingQuestion.id}`);
      showNotice('success', `Question #${deletingQuestion.id} deleted permanently.`);
      setQuestions(prev => prev.filter(q => q.id !== deletingQuestion.id));
      setDeletingQuestion(null);
      loadQuestions();
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Failed to delete question.');
      setDeletingQuestion(null);
    }
  };

  // ==========================================
  // 5. EXAM HANDLERS (SECTIONS 14, 15, 17, 18, 19, 20, 21, 22)
  // ==========================================

  const openCreateExamModal = () => {
    setEditingExam(null);
    setExamFormTitle('');
    setExamFormCode('');

    // Pre-fill academic parameters
    const initialDeptId = (currentUser?.role === 'hod' && currentUser.department_id)
      || (selectedDeptWorkspace?.id)
      || (departments.length > 0 ? departments[0].id : '');
    setExamFormDeptId(initialDeptId);
    const initialProgId = programs.length > 0 ? programs[0].id : 1;
    setExamFormProgId(initialProgId);
    const validYears = getFilteredYears(initialProgId);
    const initialYearId = validYears.length > 0 ? validYears[0].id : '';
    setExamFormYearId(initialYearId);
    const validSems = getFilteredSemesters(initialYearId, initialProgId);
    const initialSemId = validSems.length > 0 ? validSems[0].id : '';
    setExamFormSemId(initialSemId);

    // Filter available subjects for this department
    const matching = subjects.filter(s => s.department_id === initialDeptId && s.is_active);
    setExamFormSubjectId(matching.length > 0 ? matching[0].id : (subjects.length > 0 ? subjects[0].id : ''));

    setExamFormDuration(60);
    setExamFormQuestionsCount(25);
    setExamFormMarksPerQ(1);
    setExamFormPassingPct(40);
    setExamFormSelectionMode('random');
    setExamFormStatus('published');
    setExamFormStartDate('');
    setExamFormEndDate('');
    setShowCreateExamModal(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examFormTitle.trim()) {
      showNotice('error', 'Exam Title is required.');
      return;
    }
    if (!examFormSubjectId) {
      showNotice('error', 'Subject is required. Please select a Subject for this examination.');
      return;
    }

    try {
      const payload = {
        title: examFormTitle.trim(),
        code: examFormCode.trim() || undefined,
        subject_id: Number(examFormSubjectId),
        department_id: examFormDeptId ? Number(examFormDeptId) : undefined,
        program_id: examFormProgId ? Number(examFormProgId) : undefined,
        academic_year_id: examFormYearId ? Number(examFormYearId) : undefined,
        semester_id: examFormSemId ? Number(examFormSemId) : undefined,
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
        const res = await api.put(`/admin/exams/${editingExam.id}`, payload);
        showNotice('success', `Exam '${examFormTitle}' updated.`);
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
      // Show actual backend error (e.g. active question count validation)
      showNotice('error', err.response?.data?.detail || 'Failed to save exam.');
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

  // Student Assignment Modal
  const openAssignModal = async (exam: Exam) => {
    setAssigningExam(exam);
    try {
      const [stRes, assignedRes] = await Promise.all([
        api.get<Student[]>('/admin/students/list'),
        api.get<AssignedStudent[]>(`/admin/exams/${exam.id}/students`)
      ]);
      setStudentsList(stRes.data);
      setAssignedStudents(assignedRes.data);
      setSelectedStudentIdsToAssign(assignedRes.data.map(s => s.student_id));
      if (exam.department_name) {
        setAssignFilterDept(exam.department_name);
      } else {
        setAssignFilterDept('');
      }
    } catch (err) {
      console.error('Failed to load students for assignment', err);
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

  // ==========================================
  // 6. ATTEMPT RECORDS & INSPECT & SETTINGS
  // ==========================================

  const handleInspectAttempt = async (rec: StudentSummary) => {
    if (!rec.student_id) return;
    try {
      const res = await api.get(`/admin/students/${rec.student_id}${rec.attempt_id ? `?attempt_id=${rec.attempt_id}` : ''}`);
      setInspectingAttempt(res.data);
    } catch (err: any) {
      showNotice('error', 'Failed to load attempt details.');
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

  const handleExportExcel = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`${API_BASE_URL}/admin/export/excel?token=${token}`, '_blank');
  };

  const handleExportCSV = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`${API_BASE_URL}/admin/export/csv?token=${token}`, '_blank');
  };

  // Filtered Subjects for Exam Modal according to selected Department & Academic hierarchy
  const availableExamSubjects = subjects.filter(s => {
    if (!s.is_active) return false;
    if (examFormDeptId && s.department_id !== Number(examFormDeptId)) return false;
    if (examFormProgId && s.program_id && s.program_id !== Number(examFormProgId)) return false;
    if (examFormYearId && s.academic_year_id && s.academic_year_id !== Number(examFormYearId)) return false;
    if (examFormSemId && s.semester_id && s.semester_id !== Number(examFormSemId)) return false;
    return true;
  });

  // Fallback subjects if strict academic filter is empty
  const fallbackDeptSubjects = examFormDeptId
    ? subjects.filter(s => s.department_id === Number(examFormDeptId) && s.is_active)
    : subjects.filter(s => s.is_active);

  const displayExamSubjects = availableExamSubjects.length > 0 ? availableExamSubjects : fallbackDeptSubjects;

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
                      className={`bg-slate-900 border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all ${
                        isAssigned
                          ? 'border-amber-500/50 bg-slate-900/90 ring-1 ring-amber-500/30'
                          : isSelected
                          ? 'border-sky-500/60 ring-1 ring-sky-500/30'
                          : 'border-slate-200 hover:border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-mono font-bold">
                            {d.code || 'DEPT'}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            {isAssigned && (
                              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold">
                                Your Department
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {d.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-base font-bold text-slate-900 leading-snug mb-4">
                          {d.name}
                        </h4>

                        {/* Live Metrics Grid from GET /api/departments/stats */}
                        <div className="grid grid-cols-2 gap-2.5 mb-5">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                            <span className="text-[10px] text-slate-400 block font-medium">Students</span>
                            <span className="text-lg font-bold text-slate-900">{d.students_count}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                            <span className="text-[10px] text-slate-400 block font-medium">Active Subjects</span>
                            <span className="text-lg font-bold text-indigo-400">{d.active_subjects_count}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                            <span className="text-[10px] text-slate-400 block font-medium">Total Exams</span>
                            <span className="text-lg font-bold text-purple-400">{d.exams_count}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                            <span className="text-[10px] text-slate-400 block font-medium">Active Exams</span>
                            <span className="text-lg font-bold text-emerald-400">{d.active_exams_count}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleManageDepartment(d)}
                        disabled={isForbidden}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                          isForbidden
                            ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-sky-600/20'
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
                  <button
                    onClick={() => handleToggleDeptStatus(d)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${d.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-200 hover:bg-slate-700'
                      }`}
                  >
                    {d.is_active ? 'Active' : 'Inactive'}
                  </button>
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

              <div className="flex items-center space-x-3">
                <button
                  onClick={openBulkImportModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-200"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Bulk Import (CSV / XLSX / PDF)</span>
                </button>
                <button
                  onClick={openAddStudentModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add Student</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by Roll No or Name..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={studentDeptFilter}
                onChange={(e) => setStudentDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Students Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Roll / Enrollment No</th>
                      <th className="py-3.5 px-4">Student Name</th>
                      <th className="py-3.5 px-4">Gender</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Program / Year / Sem</th>
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
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{st.enrollment_no}</td>
                          <td className="py-3.5 px-4 font-medium text-white">{st.name}</td>
                          <td className="py-3.5 px-4 text-slate-400">{st.gender || '-'}</td>
                          <td className="py-3.5 px-4 text-slate-300">{st.department}</td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {st.program || 'UG'} • {st.year || '1st Year'} • {st.semester || 'Sem 1'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.is_active
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
                              className={`p-1.5 rounded-lg transition-colors ${st.is_active
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
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <span>Subject Management</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Subjects are created manually by the administrator and mapped to departments and semesters.
                </p>
              </div>

              <button
                onClick={openAddSubjectModal}
                className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-sky-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Subject</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search subject by name or code..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={subjectDeptFilter}
                onChange={(e) => setSubjectDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id.toString()}>{d.name}</option>
                ))}
              </select>

              <select
                value={subjectStatusFilter}
                onChange={(e) => setSubjectStatusFilter(e.target.value as any)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-300 focus:outline-none"
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
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No subjects created yet. Click "+ Add Subject" to manually add a subject.
                        </td>
                      </tr>
                    ) : (
                      subjects
                        .filter((s) => {
                          const matchSearch = !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase()) || s.code.toLowerCase().includes(subjectSearch.toLowerCase());
                          const matchDept = !subjectDeptFilter || s.department_id.toString() === subjectDeptFilter;
                          const matchStatus = subjectStatusFilter === 'all' || (subjectStatusFilter === 'active' ? s.is_active : !s.is_active);
                          return matchSearch && matchDept && matchStatus;
                        })
                        .map((subj) => (
                          <tr key={subj.id} className="hover:bg-slate-800/30 transition-colors">
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
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleSubjectStatus(subj)}
                                className={`p-1.5 rounded-lg transition-colors ${subj.is_active
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
                                title="Delete"
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
              </div>

              <button
                onClick={openAddQuestionModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Question</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search question text or topic..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={questionDeptFilter}
                onChange={(e) => setQuestionDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id.toString()}>{d.name}</option>
                ))}
              </select>

              <select
                value={questionSubjectFilter}
                onChange={(e) => setQuestionSubjectFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id.toString()}>{s.name}</option>
                ))}
              </select>

              <select
                value={questionStatusFilter}
                onChange={(e) => setQuestionStatusFilter(e.target.value as any)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-300 focus:outline-none"
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
                    {questions
                      .filter((q) => {
                        const matchSearch = !questionSearch || q.question_text.toLowerCase().includes(questionSearch.toLowerCase()) || (q.topic && q.topic.toLowerCase().includes(questionSearch.toLowerCase()));
                        const matchDept = !questionDeptFilter || q.department_id?.toString() === questionDeptFilter;
                        const matchSubj = !questionSubjectFilter || q.subject_id?.toString() === questionSubjectFilter;
                        const matchStatus = questionStatusFilter === 'all' || (questionStatusFilter === 'active' ? q.is_active : !q.is_active);
                        return matchSearch && matchDept && matchSubj && matchStatus;
                      })
                      .map((q) => (
                        <tr key={q.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-500">{q.id}</td>
                          <td className="py-3.5 px-4 max-w-md">
                            <p className="font-medium text-white line-clamp-2">{q.question_text}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            <span className="font-semibold text-slate-300 block">{q.subject_name || 'General DSA'}</span>
                            <span className="text-[11px] text-slate-500">{q.topic || 'DSA'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">{q.correct_answer}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                              {q.difficulty || 'Medium'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${q.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-200'
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
                                setQFormTopic(q.topic || 'Data Structures');
                                setQFormDifficulty(q.difficulty || 'Medium');
                                setQFormMarks(q.marks || 1);
                                setQFormDeptId(q.department_id || '');
                                setQFormSubjectId(q.subject_id || '');
                                setShowAddQuestionModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleQuestionStatus(q)}
                              className={`p-1.5 rounded-lg transition-colors ${q.is_active
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
                              title="Delete"
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
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <span>Examination Management & Student Assignment</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Configure department examinations and grant student-specific access authorization.
                </p>
              </div>

              <button
                onClick={openCreateExamModal}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-purple-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Examination</span>
              </button>
            </div>

            {/* Exam Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search examinations..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={examStatusFilter}
                onChange={(e) => setExamStatusFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Exams Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
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
                    {exams.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No examinations created yet. Click "+ Create Examination" to configure a new test.
                        </td>
                      </tr>
                    ) : (
                      exams
                        .filter((ex) => {
                          const matchSearch = !examSearch || ex.title.toLowerCase().includes(examSearch.toLowerCase()) || (ex.subject_name && ex.subject_name.toLowerCase().includes(examSearch.toLowerCase()));
                          const matchStatus = !examStatusFilter || ex.status === examStatusFilter;
                          return matchSearch && matchStatus;
                        })
                        .map((ex) => (
                          <tr key={ex.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 block">{ex.title}</span>
                              <span className="text-[11px] text-slate-500 font-mono">Code: {ex.code || `EXAM-${ex.id}`}</span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-300">{ex.subject_name || 'General'}</td>
                            <td className="py-3.5 px-4 text-slate-400">{ex.department_name || 'All'}</td>
                            <td className="py-3.5 px-4 text-slate-300">
                              {ex.duration_minutes} Mins • {ex.total_questions} Questions
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 bg-sky-500/10 border border-blue-200 text-blue-600 font-bold rounded-lg">
                                {ex.assigned_students_count || 0} Students
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">{ex.attempts_count || 0}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${ex.status === 'published'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : ex.status === 'draft'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                }`}>
                                {ex.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              <button
                                onClick={() => openAssignModal(ex)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Assign</span>
                              </button>
                              <button
                                onClick={() => handleToggleExamStatus(ex, ex.status === 'published' ? 'closed' : 'published')}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                title={ex.status === 'published' ? 'Close Exam' : 'Publish Exam'}
                              >
                                <Power className="w-4 h-4" />
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
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel Export</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-200"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV Export</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search student records..."
                  value={recordsSearch}
                  onChange={(e) => setRecordsSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={recordsDeptFilter}
                onChange={(e) => setRecordsDeptFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-300 focus:outline-none"
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
                    {studentRecords
                      .filter((rec) => {
                        const matchSearch = !recordsSearch || rec.name.toLowerCase().includes(recordsSearch.toLowerCase()) || rec.enrollment_no.toLowerCase().includes(recordsSearch.toLowerCase());
                        const matchDept = !recordsDeptFilter || rec.department === recordsDeptFilter;
                        return matchSearch && matchDept;
                      })
                      .map((rec) => (
                        <tr key={`${rec.student_id}-${rec.attempt_id || 0}`} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{rec.name}</span>
                            <span className="font-mono text-blue-600 text-[11px]">{rec.enrollment_no}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">{rec.department}</td>
                          <td className="py-3.5 px-4 text-slate-400">{rec.exam_title || 'General DSA Assessment'}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{rec.score ?? '-'}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                            {rec.percentage !== null ? `${rec.percentage.toFixed(1)}%` : '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(rec.tab_switch_count || 0) > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'
                                }`}>
                                {rec.tab_switch_count || 0} Tab Switches
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${rec.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : rec.status === 'timed_out'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleInspectAttempt(rec)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Inspect Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {rec.attempt_id && (
                              <button
                                onClick={() => setDeletingAttempt(rec)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="Delete Attempt"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
                <label className="block text-slate-400 font-semibold mb-1">Number of Questions</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={settingsQuestionCount}
                  onChange={(e) => setSettingsQuestionCount(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Time Limit (Minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={settingsTimeLimit}
                  onChange={(e) => setSettingsTimeLimit(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
                >
                  {settingsSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
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
              <button onClick={() => setShowAddDeptModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDepartment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Department Full Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Computer Science & Engineering"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-semibold">Department *</label>
                  {currentUser?.role === 'hod' && (
                    <span className="text-amber-400 text-[10px] flex items-center gap-1 font-semibold">
                      <Lock className="w-2.5 h-2.5" /> Locked to {currentUser.department_name || 'your department'}
                    </span>
                  )}
                </div>
                <select
                  required
                  disabled={currentUser?.role === 'hod'}
                  value={subjectFormDeptId}
                  onChange={(e) => setSubjectFormDeptId(e.target.value ? Number(e.target.value) : '')}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white ${
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
                  <label className="block text-slate-400 font-semibold mb-1">Program</label>
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
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
                  >
                    <option value="">Select Program...</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Year</label>
                  <select
                    value={subjectFormYearId}
                    onChange={(e) => {
                      const newYId = e.target.value ? Number(e.target.value) : '';
                      setSubjectFormYearId(newYId);
                      const validSems = getFilteredSemesters(newYId, subjectFormProgId);
                      setSubjectFormSemId(validSems.length > 0 ? validSems[0].id : '');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
                  >
                    <option value="">Select Year...</option>
                    {getFilteredYears(subjectFormProgId).map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Semester</label>
                  <select
                    value={subjectFormSemId}
                    onChange={(e) => setSubjectFormSemId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
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
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
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
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Roll / Enrollment No *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BT26F05F001"
                  value={stFormEnrollment}
                  onChange={(e) => setStFormEnrollment(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-400 font-semibold">Department *</label>
                    {currentUser?.role === 'hod' && (
                      <span className="text-amber-400 text-[10px] flex items-center gap-1 font-semibold">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>
                  <select
                    required
                    disabled={currentUser?.role === 'hod'}
                    value={stFormDept}
                    onChange={(e) => setStFormDept(e.target.value)}
                    className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white ${
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
                  <label className="block text-slate-400 font-semibold mb-1">Gender</label>
                  <select
                    value={stFormGender}
                    onChange={(e) => setStFormGender(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
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
                  <label className="block text-slate-400 font-semibold mb-1">Program</label>
                  <select
                    value={stFormProg}
                    onChange={(e) => {
                      const newProg = e.target.value;
                      setStFormProg(newProg);
                      const defaultYear = newProg === 'UG' ? '1st Year' : 'M.Tech 1st Year';
                      setStFormYear(defaultYear);
                      setStFormSem('Semester 1');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
                  >
                    <option value="UG">UG (B.Tech)</option>
                    <option value="M.Tech">M.Tech</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Year</label>
                  <select
                    value={stFormYear}
                    onChange={(e) => {
                      const newYear = e.target.value;
                      setStFormYear(newYear);
                      const sems = getStudentSemestersForYear(stFormProg, newYear);
                      setStFormSem(sems[0]);
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
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
                  <label className="block text-slate-400 font-semibold mb-1">Semester</label>
                  <select
                    value={stFormSem}
                    onChange={(e) => setStFormSem(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
                  >
                    {getStudentSemestersForYear(stFormProg, stFormYear).map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Password or Secure PIN</label>
                <input
                  type="password"
                  placeholder="Default (Roll Number)"
                  value={stFormPassword}
                  onChange={(e) => setStFormPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
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
              <button onClick={() => setShowBulkImportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkImportStudents} className="space-y-4 text-xs">
              <p className="text-slate-400">
                Select target academic group and upload student roll list file (<span className="text-white font-semibold">CSV, Excel XLSX, or PDF roll-list</span>).
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-semibold">Target Department *</label>
                  {currentUser?.role === 'hod' && (
                    <span className="text-amber-400 text-[10px] flex items-center gap-1 font-semibold">
                      <Lock className="w-2.5 h-2.5" /> Locked to {currentUser.department_name || 'your department'}
                    </span>
                  )}
                </div>
                <select
                  required
                  disabled={currentUser?.role === 'hod'}
                  value={importDept}
                  onChange={(e) => setImportDept(e.target.value)}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white ${
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
                  <label className="block text-slate-400 font-semibold mb-1">Program</label>
                  <select
                    value={importProg}
                    onChange={(e) => {
                      setImportProg(e.target.value);
                      setImportYear(e.target.value === 'UG' ? '1st Year' : 'M.Tech 1st Year');
                      setImportSem('Semester 1');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
                  >
                    <option value="UG">UG</option>
                    <option value="M.Tech">M.Tech</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Year</label>
                  <select
                    value={importYear}
                    onChange={(e) => {
                      setImportYear(e.target.value);
                      const sems = getStudentSemestersForYear(importProg, e.target.value);
                      setImportSem(sems[0]);
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
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
                  <label className="block text-slate-400 font-semibold mb-1">Semester</label>
                  <select
                    value={importSem}
                    onChange={(e) => setImportSem(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
                  >
                    {getStudentSemestersForYear(importProg, importYear).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-300"
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
                />
              </div>

              {/* Department First per Section 18 & 19 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-semibold">Department *</label>
                  {currentUser?.role === 'hod' && (
                    <span className="text-amber-400 text-[10px] flex items-center gap-1 font-semibold">
                      <Lock className="w-2.5 h-2.5" /> Locked to {currentUser.department_name || 'your department'}
                    </span>
                  )}
                </div>
                <select
                  required
                  disabled={currentUser?.role === 'hod'}
                  value={examFormDeptId}
                  onChange={(e) => {
                    const newDeptId = e.target.value ? Number(e.target.value) : '';
                    setExamFormDeptId(newDeptId);
                    // Update subject dropdown to match this department
                    const matching = subjects.filter(s => s.department_id === newDeptId && s.is_active);
                    setExamFormSubjectId(matching.length > 0 ? matching[0].id : '');
                  }}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white ${
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
                  <label className="block text-slate-400 font-semibold mb-1">Program</label>
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
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
                  >
                    <option value="">All Programs</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Year</label>
                  <select
                    value={examFormYearId}
                    onChange={(e) => {
                      const newYId = e.target.value ? Number(e.target.value) : '';
                      setExamFormYearId(newYId);
                      const validSems = getFilteredSemesters(newYId, examFormProgId);
                      setExamFormSemId(validSems.length > 0 ? validSems[0].id : '');
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
                  >
                    <option value="">All Years</option>
                    {getFilteredYears(examFormProgId).map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Semester</label>
                  <select
                    value={examFormSemId}
                    onChange={(e) => setExamFormSemId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white text-[11px]"
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
                <label className="block text-slate-400 font-semibold mb-1">Subject Association *</label>
                <select
                  required
                  value={examFormSubjectId}
                  onChange={(e) => setExamFormSubjectId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
                >
                  <option value="">Select Subject...</option>
                  {displayExamSubjects.length === 0 ? (
                    <option disabled value="">
                      {examFormDeptId ? 'No subjects found for this department. Please add a subject first.' : 'Select a department above to see subjects'}
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

              {/* Duration, Questions, Marks, Pass % */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormDuration}
                    onChange={(e) => setExamFormDuration(parseInt(e.target.value, 10) || 60)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Questions</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormQuestionsCount}
                    onChange={(e) => setExamFormQuestionsCount(parseInt(e.target.value, 10) || 25)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Marks/Q</label>
                  <input
                    type="number"
                    min={1}
                    value={examFormMarksPerQ}
                    onChange={(e) => setExamFormMarksPerQ(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Pass %</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={examFormPassingPct}
                    onChange={(e) => setExamFormPassingPct(parseFloat(e.target.value) || 40)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Question Selection Mode</label>
                  <select
                    value={examFormSelectionMode}
                    onChange={(e) => setExamFormSelectionMode(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  >
                    <option value="published">Published (Available)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Start Date (Optional)</label>
                  <input
                    type="date"
                    value={examFormStartDate}
                    onChange={(e) => setExamFormStartDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={examFormEndDate}
                    onChange={(e) => setExamFormEndDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
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
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
                />
              </div>

              <select
                value={assignFilterDept}
                onChange={(e) => setAssignFilterDept(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-white"
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
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-800/60 bg-slate-950/60 text-xs">
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
                      className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isChecked ? 'bg-sky-500/10' : 'hover:bg-slate-800/40'
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
                          className="w-4 h-4 rounded border-slate-200 text-sky-600 focus:ring-0"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{st.name}</p>
                          <p className="text-[11px] font-mono text-blue-600">{st.enrollment_no}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-300 font-medium">{st.department}</p>
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
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
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
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>{editingQuestion ? 'Edit Question' : '+ Add Question to Question Bank'}</span>
              </h4>
              <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Subject Association</label>
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  >
                    <option value="">General (No specific subject)</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-400 font-semibold">Department</label>
                    {currentUser?.role === 'hod' && (
                      <span className="text-amber-400 text-[10px] flex items-center gap-1 font-semibold">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>
                  <select
                    disabled={currentUser?.role === 'hod'}
                    value={qFormDeptId}
                    onChange={(e) => setQFormDeptId(e.target.value ? Number(e.target.value) : '')}
                    className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white ${
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
                <label className="block text-slate-400 font-semibold mb-1">Question Text *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Which of the following is a linear data structure?"
                  value={qFormText}
                  onChange={(e) => setQFormText(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-white"
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
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Option B *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptB}
                    onChange={(e) => setQFormOptB(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Option C *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptC}
                    onChange={(e) => setQFormOptC(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Option D *</label>
                  <input
                    type="text"
                    required
                    value={qFormOptD}
                    onChange={(e) => setQFormOptD(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Correct Answer</label>
                  <select
                    value={qFormCorrect}
                    onChange={(e) => setQFormCorrect(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={qFormMarks}
                    onChange={(e) => setQFormMarks(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Difficulty</label>
                  <select
                    value={qFormDifficulty}
                    onChange={(e) => setQFormDifficulty(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Topic</label>
                  <input
                    type="text"
                    value={qFormTopic}
                    onChange={(e) => setQFormTopic(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-white"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-base font-bold text-slate-900">Delete Subject</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete subject <span className="font-bold text-slate-900">'{deletingSubject.name}'</span>?
              If this subject is referenced by existing questions or exams, the deletion will be blocked and deactivation recommended to preserve academic history.
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setDeletingSubject(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Delete Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 9: DELETE QUESTION CONFIRMATION                     */}
      {/* ========================================================= */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-base font-bold text-slate-900">Delete Question #{deletingQuestion.id}</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete this question? If it has historical assessment records, please deactivate it instead.
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setDeletingQuestion(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteQuestion}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Delete Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 10: DELETE ATTEMPT CONFIRMATION                     */}
      {/* ========================================================= */}
      {deletingAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-base font-bold text-slate-900">Delete Assessment Attempt</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete assessment attempt <span className="font-mono text-blue-600 font-bold">#{deletingAttempt.attempt_id}</span> for student <span className="font-bold text-slate-900">{deletingAttempt.name}</span>?
              This will remove score records and answer logs while preserving the student account and examination.
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setDeletingAttempt(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAttempt}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Delete Attempt
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
                <p className="text-xs text-slate-400">
                  {inspectingAttempt.student?.department} • Score: {inspectingAttempt.attempt?.score ?? 'N/A'}/{inspectingAttempt.attempt?.total_questions ?? 'N/A'} ({inspectingAttempt.attempt?.percentage?.toFixed(1) ?? '0.0'}%)
                </p>
              </div>
              <button onClick={() => setInspectingAttempt(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Anti-Cheating Security Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <h5 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
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
              <h5 className="font-bold text-slate-300">Question-Wise Response Audit:</h5>
              {inspectingAttempt.answers && inspectingAttempt.answers.length > 0 ? (
                inspectingAttempt.answers.map((ans: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600 font-mono">Q{ans.question_number || idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${ans.is_correct ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                        {ans.is_correct ? 'Correct (+1)' : 'Incorrect (0)'}
                      </span>
                    </div>
                    <p className="text-white font-medium">{ans.question || ans.question_text}</p>
                    <div className="flex items-center space-x-4 text-[11px] pt-1">
                      <span className="text-slate-400">
                        Selected: <strong className="text-white">{ans.selected_answer || 'Unanswered'}</strong>
                      </span>
                      <span className="text-slate-400">
                        Correct: <strong className="text-emerald-400">{ans.correct_answer}</strong>
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
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
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
