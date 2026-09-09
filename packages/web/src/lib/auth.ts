'use client';

import { setToken, clearToken } from './api';

export function saveAuth(token: string, email: string): void {
  setToken(token);
  localStorage.setItem('tcg_email', email);
}

export function getEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tcg_email');
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('tcg_token');
}

export function logout(): void {
  clearToken();
  localStorage.removeItem('tcg_email');
}
