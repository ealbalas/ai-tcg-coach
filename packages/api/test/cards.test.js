import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadCards, getCardName } from '../src/cards.js';

describe('cards module', () => {
  before(async () => {
    // Runs loadCards once; may use network or fall back to hardcoded map
    await loadCards();
  });

  it('returns null for a clearly unknown card ID', () => {
    assert.strictEqual(getCardName('UNKNOWN-999'), null);
  });

  it('returns null for null input', () => {
    assert.strictEqual(getCardName(null), null);
  });

  it('returns null for undefined input', () => {
    assert.strictEqual(getCardName(undefined), null);
  });

  it('has at least some cards loaded after loadCards()', () => {
    // After loadCards() the cache should have at least one entry (remote or fallback).
    // Test a set of IDs that appear in both the hardcoded fallback and common community data.
    const knownIds = [
      'ST01-001', 'ST02-001', 'ST03-001',
      'OP01-001', 'OP01-002', 'OP01-060',
    ];
    const hits = knownIds.filter((id) => getCardName(id) !== null);
    // At least some should resolve - if zero hits, both remote and fallback failed
    assert.ok(hits.length > 0, `Expected at least one known leader ID to resolve, got 0 from: ${knownIds.join(', ')}`);
  });

  it('returns a non-empty string (not null) for any resolved ID', () => {
    const knownIds = ['ST01-001', 'OP01-001', 'OP02-001', 'ST04-001'];
    for (const id of knownIds) {
      const name = getCardName(id);
      if (name !== null) {
        assert.strictEqual(typeof name, 'string');
        assert.ok(name.length > 0, `Card name for ${id} should not be empty`);
      }
    }
  });
});
