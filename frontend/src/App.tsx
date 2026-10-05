import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudentRegistration } from './pages/StudentRegistration';
import { StudentDashboard } from './pages/StudentDashboard';
import { StudentTest } from './pages/StudentTest';
import { StudentResult } from './pages/StudentResult';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminStudentDetails } from './pages/AdminStudentDetails';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
};

export default App;
