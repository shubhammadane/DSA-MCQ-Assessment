import axios from 'axios';

// Resolve API base URL using VITE_API_URL environment variable with development fallback
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return 'http://localhost:8000/api';
};

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem('admin_token');
  const studentToken = sessionStorage.getItem('student_token') || localStorage.getItem('student_token');

  // If request is directed to student endpoints and student token exists, use student token
  if (config.url?.includes('/student/') || config.url?.includes('/security-log')) {
    if (studentToken && config.headers) {
      config.headers.Authorization = `Bearer ${studentToken}`;
      return config;
    }
  }

  // Otherwise, if admin token exists, attach admin token
  if (adminToken && config.headers && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else if (studentToken && config.headers && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${studentToken}`;
  }
  return config;
});

export default api;
