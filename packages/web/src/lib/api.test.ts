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

// Mock window so redirect assertions can be captured in the Node test environment
let locationHref = '';
vi.stubGlobal('window', {
  location: {
    get href() { return locationHref; },
    set href(value: string) { locationHref = value; },
  },
});

import { setToken, getCards } from './api';

describe('request() - 401 handling', () => {
  beforeEach(() => {
    localStorage.clear();
    locationHref = '';
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

  it('redirects to / on 401 when a session token was present', async () => {
    setToken('stale-token');

    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Token expired' }),
    });

    await expect(getCards()).rejects.toThrow('Token expired');

    expect(locationHref).toBe('/');
  });

  it('does not redirect on 401 when no token is present', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Invalid credentials' }),
    });

    await expect(getCards()).rejects.toThrow('Invalid credentials');

    expect(locationHref).toBe('');
  });
});
