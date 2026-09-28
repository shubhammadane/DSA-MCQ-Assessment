import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudentRegistration } from './pages/StudentRegistration';
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
        <Route path="/test/:attemptId" element={<StudentTest />} />
        <Route path="/result/:attemptId" element={<StudentResult />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<AdminDashboard />} />
        <Route path="/admin/student/:studentId" element={<AdminStudentDetails />} />

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
