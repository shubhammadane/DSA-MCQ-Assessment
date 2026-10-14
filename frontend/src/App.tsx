import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const StudentRegistration = lazy(() => import('./pages/StudentRegistration').then(module => ({ default: module.StudentRegistration })));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard').then(module => ({ default: module.StudentDashboard })));
const StudentTest = lazy(() => import('./pages/StudentTest').then(module => ({ default: module.StudentTest })));
const StudentResult = lazy(() => import('./pages/StudentResult').then(module => ({ default: module.StudentResult })));
const AdminLogin = lazy(() => import('./pages/AdminLogin').then(module => ({ default: module.AdminLogin })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const AdminStudentDetails = lazy(() => import('./pages/AdminStudentDetails').then(module => ({ default: module.AdminStudentDetails })));

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">Loading portal…</div>}>
        <Routes>
        {/* Student Routes */}
        <Route path="/" element={<StudentRegistration />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/test/:attemptId" element={<StudentTest />} />
        <Route path="/result/:attemptId" element={<StudentResult />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/academic" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<AdminDashboard />} />
        <Route path="/admin/subjects" element={<AdminDashboard />} />
        <Route path="/admin/questions" element={<AdminDashboard />} />
        <Route path="/admin/exams" element={<AdminDashboard />} />
        <Route path="/admin/settings" element={<AdminDashboard />} />
        <Route path="/admin/student/:studentId" element={<AdminStudentDetails />} />

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
