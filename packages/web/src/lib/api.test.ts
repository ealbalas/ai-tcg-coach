import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before importing the module under test
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage since tests run in Node (no browser globals)
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
});

import { setToken, getCards } from './api';

describe('request() - 401 handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clears stored token on 401 response', async () => {
    setToken('stale-token');
    expect(localStorage.getItem('tcg_token')).toBe('stale-token');

    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Token expired' }),
    });

    await expect(getCards()).rejects.toThrow('Token expired');

    // Token must be cleared so the user cannot keep making authenticated requests
    expect(localStorage.getItem('tcg_token')).toBeNull();
  });

  it('does not clear token on non-401 errors', async () => {
    setToken('valid-token');

    mockFetch.mockResolvedValue({
      status: 500,
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Server error' }),
    });

    await expect(getCards()).rejects.toThrow('Server error');

    expect(localStorage.getItem('tcg_token')).toBe('valid-token');
  });
});
