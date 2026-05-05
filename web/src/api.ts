import axios from 'axios';
import { create } from 'zustand';

// In Docker via vite proxy, API_URL should be empty string (same-origin)
// Locally it points at localhost:3001
const API_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pl_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth store
interface User { id: string; email: string; name?: string }
interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('pl_token'),
  setAuth: (user, token) => {
    localStorage.setItem('pl_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('pl_token');
    set({ user: null, token: null });
  },
}));

// Types
export interface Entry {
  id: string;
  title?: string;
  output: string;
  command?: string;
  tags: string[];
  exit_code?: number;
  is_public: boolean;
  share_token?: string;
  created_at: string;
  author_name?: string;
}
