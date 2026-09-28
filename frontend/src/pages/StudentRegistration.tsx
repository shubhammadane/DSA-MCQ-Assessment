import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, User, Building, CreditCard, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export const StudentRegistration: React.FC = () => {
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleStartTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentNo.trim() || !name.trim() || !department.trim()) {
      setError('All fields (Enrollment Number, Name, Department) are strictly required.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/attempts/start', {
        enrollment_no: enrollmentNo.trim(),
        name: name.trim(),
        department: department.trim(),
      });

      const { attempt_id, student } = response.data;
      
      // Store session details
      sessionStorage.setItem('attempt_id', attempt_id.toString());
      sessionStorage.setItem('student', JSON.stringify(student));

      // Navigate to test page
      navigate(`/test/${attempt_id}`);
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to start test. Please check backend connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-sky-500/10 text-sky-400 rounded-xl mb-2">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">DSA MCQ Assessment</h1>
          <p className="text-sm text-slate-400">Department of Computer Science & Engineering</p>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleStartTest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Enrollment Number *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <CreditCard className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
                placeholder="e.g. EN2024001"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Student Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Mercer"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Department *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Building className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science & Engineering"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3.5 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>Initializing Test...</span>
            ) : (
              <>
                <span>START TEST</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800/80 text-center">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center space-x-1.5 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Access Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
