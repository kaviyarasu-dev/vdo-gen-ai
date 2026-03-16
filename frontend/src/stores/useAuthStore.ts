import { create } from 'zustand';
import type { User } from '@/types/auth.types';

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
};

type AuthActions = {
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: User) => void;
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('auth_token'),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('auth_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    set({ user, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (user) => {
    set({ user });
  },
}));
