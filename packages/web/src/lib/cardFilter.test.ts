import { describe, it, expect } from 'vitest';
import { filterCards } from './cardFilter';
import type { CardEntry } from './api';

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

const RED_CARD = makeCard({ id: 'A', color: 'Red', type: 'Character', name: 'Luffy' });
const BLUE_CARD = makeCard({ id: 'B', color: 'Blue', type: 'Event', name: 'Nami' });
const GREEN_CARD = makeCard({ id: 'C', color: 'Green', type: 'Leader', name: 'Zoro' });
const MULTI_CARD = makeCard({ id: 'D', color: 'Red/Blue', type: 'Character', name: 'Ace' });

const ALL = [RED_CARD, BLUE_CARD, GREEN_CARD, MULTI_CARD];

describe('filterCards - color filter', () => {
  it('returns all cards when color is All Colors', () => {
    expect(filterCards(ALL, '', 'All', 'All Colors')).toHaveLength(4);
  });

  it('includes Red card when Red is selected', () => {
    const result = filterCards(ALL, '', 'All', 'Red');
    expect(result.map((c) => c.id)).toContain('A');
  });

  it('excludes Blue card when Red is selected', () => {
    const result = filterCards(ALL, '', 'All', 'Red');
    expect(result.map((c) => c.id)).not.toContain('B');
  });

  it('multi-color Red/Blue card matches Red filter', () => {
    const result = filterCards(ALL, '', 'All', 'Red');
    expect(result.map((c) => c.id)).toContain('D');
  });

  it('multi-color Red/Blue card matches Blue filter', () => {
    const result = filterCards(ALL, '', 'All', 'Blue');
    expect(result.map((c) => c.id)).toContain('D');
  });

  it('multi-color card does not match Green filter', () => {
    const result = filterCards(ALL, '', 'All', 'Green');
    expect(result.map((c) => c.id)).not.toContain('D');
  });
});

describe('filterCards - type filter', () => {
  it('filters by Character type', () => {
    const result = filterCards(ALL, '', 'Character', 'All Colors');
    expect(result.map((c) => c.id)).toEqual(['A', 'D']);
  });

  it('filters by Event type', () => {
    const result = filterCards(ALL, '', 'Event', 'All Colors');
    expect(result.map((c) => c.id)).toEqual(['B']);
  });
});

describe('filterCards - search filter', () => {
  it('matches card name case-insensitively', () => {
    const result = filterCards(ALL, 'luffy', 'All', 'All Colors');
    expect(result.map((c) => c.id)).toEqual(['A']);
  });

  it('returns empty when no name matches', () => {
    const result = filterCards(ALL, 'shanks', 'All', 'All Colors');
    expect(result).toHaveLength(0);
  });
});

describe('filterCards - combined filters', () => {
  it('applies type + color + search together', () => {
    const result = filterCards(ALL, 'ace', 'Character', 'Blue');
    expect(result.map((c) => c.id)).toEqual(['D']);
  });

  it('returns empty when no card matches all three', () => {
    const result = filterCards(ALL, 'luffy', 'Character', 'Blue');
    expect(result).toHaveLength(0);
  });

  it('Red Character with query matches correctly', () => {
    const result = filterCards(ALL, 'lu', 'Character', 'Red');
    expect(result.map((c) => c.id)).toEqual(['A']);
  });
});
