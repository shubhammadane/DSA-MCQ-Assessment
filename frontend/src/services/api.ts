import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { canRetryRequest } from './retryPolicy';

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
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const adminToken = sessionStorage.getItem('admin_token');
  const studentToken = sessionStorage.getItem('student_token');

  // If request is directed to student endpoints and student token exists, use student token
  if (config.url?.includes('/student/') || config.url?.startsWith('/attempts/') || config.url?.startsWith('/questions?')) {
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

api.interceptors.response.use(response => response, async error => {
  const config = error.config as (InternalAxiosRequestConfig & { examRetries?: number }) | undefined;
  const retries = config?.examRetries ?? 0;
  if (!config || !canRetryRequest(config.method, config.url, error.response?.status, retries)) throw error;
  config.examRetries = retries + 1;
  const retryAfter = Number(error.response?.headers?.['retry-after']);
  const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(5000, retryAfter * 1000)
    : Math.min(4000, 400 * 2 ** retries) + Math.random() * 200;
  await new Promise(resolve => setTimeout(resolve, delay));
  return api.request(config);
});

export default api;
