'use client';

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import axios from 'axios';
import type { PortalProfile } from './usePortalApi';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const AUTH_PREFIX = '/api/portal/auth';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyName: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface PortalAuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

export { PortalAuthContext };
export type { PortalAuthContextValue, AuthUser, LoginCredentials, RegisterInput, AuthState };

export function usePortalAuthProvider(): PortalAuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem('portal_access_token');
    const storedUser = localStorage.getItem('portal_user');
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser) as AuthUser;
        setState({ user, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('portal_access_token');
        localStorage.removeItem('portal_user');
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await axios.post<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>(`${API_BASE_URL}${AUTH_PREFIX}/login`, credentials);

    const { accessToken, refreshToken, user } = response.data;
    localStorage.setItem('portal_access_token', accessToken);
    localStorage.setItem('portal_refresh_token', refreshToken);
    localStorage.setItem('portal_user', JSON.stringify(user));
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await axios.post<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>(`${API_BASE_URL}${AUTH_PREFIX}/register`, input);

    const { accessToken, refreshToken, user } = response.data;
    localStorage.setItem('portal_access_token', accessToken);
    localStorage.setItem('portal_refresh_token', refreshToken);
    localStorage.setItem('portal_user', JSON.stringify(user));
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('portal_access_token');
    localStorage.removeItem('portal_refresh_token');
    localStorage.removeItem('portal_user');
    setState({ user: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setState((prev) => {
      if (!prev.user) return prev;
      const updatedUser = { ...prev.user, ...updates };
      localStorage.setItem('portal_user', JSON.stringify(updatedUser));
      return { ...prev, user: updatedUser };
    });
  }, []);

  return useMemo(
    () => ({
      ...state,
      login,
      register,
      logout,
      updateUser,
    }),
    [state, login, register, logout, updateUser]
  );
}

export function usePortalAuth(): PortalAuthContextValue {
  const context = useContext(PortalAuthContext);
  if (!context) {
    throw new Error('usePortalAuth must be used within a PortalAuthProvider');
  }
  return context;
}
