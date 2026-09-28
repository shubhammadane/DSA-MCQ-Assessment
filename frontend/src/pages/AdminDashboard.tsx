import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, Award, Percent, LogOut, Download, FileText, UserCheck, Search, Eye } from 'lucide-react';
import api from '../services/api';
import type { AdminStats, StudentSummary } from '../types';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  const handleExportSummaryExcel = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`http://localhost:8000/api/admin/export/excel?type=summary&token=${token}`, '_blank');
  };

  const handleExportDetailedExcel = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`http://localhost:8000/api/admin/export/excel?type=detailed&token=${token}`, '_blank');
  };

  const handleExportSummaryCSV = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`http://localhost:8000/api/admin/export/csv?type=summary&token=${token}`, '_blank');
  };

  const handleExportDetailedCSV = () => {
    const token = localStorage.getItem('admin_token') || '';
    window.open(`http://localhost:8000/api/admin/export/csv?type=detailed&token=${token}`, '_blank');
  };

  const filteredStudents = students.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.enrollment_no.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Loading Admin Analytics & Student Records...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">Admin Management Dashboard</h1>
            <p className="text-xs text-slate-400">DSA MCQ Assessment Control Panel</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs flex items-center space-x-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
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
              <p className="text-3xl font-black text-emerald-400">{stats.completed_tests}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Avg Score</span>
                <Award className="w-5 h-5" />
              </div>
              <p className="text-3xl font-black text-amber-400">
                {stats.average_score} <span className="text-sm font-normal text-slate-500">/ 50</span>
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-purple-400">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Avg Percentage</span>
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
                  <th className="py-3.5 px-4">Attempt Date</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
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
                        {s.score !== null ? `${s.score} / 50` : '-'}
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
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {s.attempt_date ? new Date(s.attempt_date).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {s.status === 'completed' && s.student_id ? (
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

      </main>
    </div>
  );
};
