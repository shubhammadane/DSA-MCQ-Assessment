import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Building,
  CreditCard,
  Lock,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import { CollegeBranding } from '../components/CollegeBranding';

export const StudentRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<'login' | 'practice'>('login');

  // Student Login State (Secure Examination Login)
  const [loginEnrollment, setLoginEnrollment] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Practice Assessment State (Legacy direct DSA test)
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEnrollment.trim() || !loginPassword.trim()) {
      setLoginError('Both Enrollment Number and Password / PIN are required.');
      return;
    }

    setLoginError(null);
    setLoginLoading(true);

    try {
      const response = await api.post('/student/login', {
        enrollment_no: loginEnrollment.trim(),
        password: loginPassword.trim(),
      });

      const { access_token, student } = response.data;
      sessionStorage.setItem('student_token', access_token);
      localStorage.setItem('student_token', access_token);
      sessionStorage.setItem('student', JSON.stringify(student));

      navigate('/student/dashboard');
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setLoginError(err.response.data.detail);
      } else {
        setLoginError('Authentication failed. Please verify credentials or contact administrator.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleStartPracticeTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentNo.trim() || !name.trim() || !department.trim()) {
      setPracticeError('All fields (Enrollment Number, Name, Department) are required.');
      return;
    }

    setPracticeError(null);
    setPracticeLoading(true);

    try {
      const response = await api.post('/attempts/start', {
        enrollment_no: enrollmentNo.trim(),
        name: name.trim(),
        department: department.trim(),
      });

      const { attempt_id, student } = response.data;
      sessionStorage.setItem('attempt_id', attempt_id.toString());
      sessionStorage.setItem('student', JSON.stringify(student));

      navigate(`/test/${attempt_id}`);
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setPracticeError(err.response.data.detail);
      } else {
        setPracticeError('Failed to initialize test attempt. Please try again.');
      }
    } finally {
      setPracticeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-xl p-8 space-y-6 relative overflow-hidden">
        {/* Subtle accent decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50/80 rounded-full blur-2xl pointer-events-none" />

        {/* Header — College Branding */}
        <div className="flex flex-col items-center space-y-3 relative z-10">
          <CollegeBranding size="md" theme="light" />
          <div className="text-center pt-2 border-t border-slate-200 w-full">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Online Examination Portal</p>
            <p className="text-[11px] text-slate-500">College Examination &amp; Assessment System</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 relative z-10">
          <button
            type="button"
            onClick={() => setActiveMode('login')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              activeMode === 'login'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Student Exam Login</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('practice')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              activeMode === 'practice'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>DSA Practice Test</span>
          </button>
        </div>

        {/* TAB 1: SECURE STUDENT EXAM LOGIN */}
        {activeMode === 'login' && (
          <form onSubmit={handleStudentLogin} className="space-y-4 relative z-10">
            {loginError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Enrollment / Roll Number *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={loginEnrollment}
                  onChange={(e) => setLoginEnrollment(e.target.value)}
                  placeholder="e.g. BT26F05F001"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Password or Secure PIN *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your student password / PIN"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Default password for new enrollments: <span className="text-slate-700 font-mono font-medium">student123</span> or your Roll Number.
              </p>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-5 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 text-sm"
            >
              {loginLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>LOGIN TO EXAM DESK</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 2: DIRECT DSA PRACTICE TEST */}
        {activeMode === 'practice' && (
          <form onSubmit={handleStartPracticeTest} className="space-y-4 relative z-10">
            {practiceError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>{practiceError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Enrollment Number *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  placeholder="e.g. EN2024001"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Student Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Department *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={practiceLoading}
              className="w-full mt-5 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 text-sm"
            >
              {practiceLoading ? (
                <span>Initializing DSA Test...</span>
              ) : (
                <>
                  <span>START 50-Q DSA TEST</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Admin Link */}
        <div className="pt-4 border-t border-slate-200 text-center relative z-10">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-xs text-slate-500 hover:text-blue-600 inline-flex items-center space-x-1.5 transition-colors font-medium"
          >
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Admin Management Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default StudentRegistration;
