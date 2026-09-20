import { describe, it, expect } from 'vitest';
import type { CardEntry } from './api';
import { parseCardId, cardImageUrl, groupCardsByBase } from './cardUtils';

function makeCard(overrides: Partial<CardEntry>): CardEntry {
  return {
    id: 'OP01-001',
    name: 'Test Card',
    type: 'Character',
    cost: 3,
    power: 5000,
    color: 'Red',
    effect: null,
    attribute: null,
    image: null,
    ...overrides,
  };
}

describe('parseCardId', () => {
  it('parses a regular card ID', () => {
    expect(parseCardId('OP01-001')).toEqual({ set: 'OP01', num: '001' });
  });

  it('parses EB set IDs', () => {
    expect(parseCardId('EB01-042')).toEqual({ set: 'EB01', num: '042' });
  });

  it('strips parallel suffix before parsing', () => {
    expect(parseCardId('EB01-001_p1')).toEqual({ set: 'EB01', num: '001' });
  });

  it('strips multi-digit parallel suffix', () => {
    expect(parseCardId('OP03-010_p2')).toEqual({ set: 'OP03', num: '010' });
  });

  it('returns null for malformed IDs', () => {
    expect(parseCardId('invalid')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCardId('')).toBeNull();
  });
});

describe('cardImageUrl', () => {
  it('returns proxy URL when image is present', () => {
    expect(cardImageUrl('https://some.url/img.png', 'OP01-001')).toBe('/api/card-image?id=OP01-001');
  });

  it('uses the provided id in the proxy URL', () => {
    expect(cardImageUrl('https://some.url/img.png', 'OP01-001_p1')).toBe('/api/card-image?id=OP01-001_p1');
  });

  it('returns null when image is null', () => {
    expect(cardImageUrl(null, 'OP01-001')).toBeNull();
  });
});

describe('groupCardsByBase', () => {
  it('groups parallels under base card', () => {
    const base = makeCard({ id: 'OP01-001', name: 'Base' });
    const p1 = makeCard({ id: 'OP01-001_p1', name: 'Base Parallel 1' });
    const p2 = makeCard({ id: 'OP01-001_p2', name: 'Base Parallel 2' });

    const result = groupCardsByBase([base, p1, p2]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('OP01-001');
    expect(result[0].parallels).toHaveLength(2);
  });

  it('preserves non-parallel cards with empty parallels array', () => {
    const a = makeCard({ id: 'OP01-001' });
    const b = makeCard({ id: 'OP01-002' });

    const result = groupCardsByBase([a, b]);

    expect(result).toHaveLength(2);
    expect(result[0].parallels).toHaveLength(0);
    expect(result[1].parallels).toHaveLength(0);
  });

  it('groups _r suffix rare-art variants under base card', () => {
    const base = makeCard({ id: 'EB01-006', name: 'Tony Tony.Chopper' });
    const r1 = makeCard({ id: 'EB01-006_r1', name: 'Tony Tony.Chopper (Rare)' });

    const result = groupCardsByBase([base, r1]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('EB01-006');
    expect(result[0].parallels).toHaveLength(1);
    expect(result[0].parallels[0].id).toBe('EB01-006_r1');
  });

  it('groups both _p and _r variants together under same base', () => {
    const base = makeCard({ id: 'OP01-001' });
    const p1 = makeCard({ id: 'OP01-001_p1' });
    const r1 = makeCard({ id: 'OP01-001_r1' });

    const result = groupCardsByBase([base, p1, r1]);

    expect(result).toHaveLength(1);
    expect(result[0].parallels).toHaveLength(2);
  });

  it('treats parallel with no base as its own base entry', () => {
    const orphan = makeCard({ id: 'OP01-999_p1', name: 'Orphan Parallel' });

    const result = groupCardsByBase([orphan]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('OP01-999_p1');
    expect(result[0].parallels).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(groupCardsByBase([])).toHaveLength(0);
  });
});
