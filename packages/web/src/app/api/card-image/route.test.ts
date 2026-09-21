import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GET } from './route';

function makeRequest(id?: string): NextRequest {
  const url = id
    ? `http://localhost/api/card-image?id=${id}`
    : 'http://localhost/api/card-image';
  return new NextRequest(url);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/card-image', () => {
  it('returns 400 for missing id', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid id', async () => {
    const res = await GET(makeRequest('invalid'));
    expect(res.status).toBe(400);
  });

  it('returns webp from Limitless CDN when it responds 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: 'webp-body',
    });

    const res = await GET(makeRequest('OP01-001'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/OP01/OP01-001_EN.webp',
    );
  });

  it('parses set code from card id for Limitless CDN URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, body: 'webp-body' });

    await GET(makeRequest('EB01-001'));
    expect(mockFetch).toHaveBeenCalledWith(
      'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/EB01/EB01-001_EN.webp',
    );
  });

  it('includes parallel suffix in Limitless CDN URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, body: 'webp-body' });

    await GET(makeRequest('OP01-001_p1'));
    expect(mockFetch).toHaveBeenCalledWith(
      'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/OP01/OP01-001_p1_EN.webp',
    );
  });

  it('falls back to en.onepiece-cardgame.com when Limitless returns non-2xx', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, body: 'png-body' });

    const res = await GET(makeRequest('OP01-001'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
    );
  });

  it('falls back to asia-en.onepiece-cardgame.com when both primary sources fail', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, body: 'png-body' });

    const res = await GET(makeRequest('OP01-001'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://asia-en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
    );
  });

  it('returns 404 when all sources fail', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    const res = await GET(makeRequest('OP01-001'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when all sources throw', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    const res = await GET(makeRequest('OP01-001'));
    expect(res.status).toBe(404);
  });

  it('sets cache-control header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, body: 'webp-body' });

    const res = await GET(makeRequest('OP01-001'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
  });
});
