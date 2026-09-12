import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadCards, getCardName, getCardDetails, normalizeEntry } from '../src/cards.js';

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

describe('normalizeEntry', () => {
  it('returns null for non-object input', () => {
    assert.strictEqual(normalizeEntry(null), null);
    assert.strictEqual(normalizeEntry('string'), null);
    assert.strictEqual(normalizeEntry(42), null);
  });

  it('returns null when id or name is missing', () => {
    assert.strictEqual(normalizeEntry({ id: 'OP01-001' }), null);
    assert.strictEqual(normalizeEntry({ name: 'Luffy' }), null);
  });

  it('extracts cost, power, color, effect, attribute from standard fields', () => {
    const entry = {
      id: 'OP01-001',
      name: 'Monkey D. Luffy',
      type: 'Leader',
      cost: 5,
      power: 5000,
      color: 'Red',
      effect: 'When this card attacks, draw 1 card.',
      attribute: 'Strike',
    };
    const result = normalizeEntry(entry);
    assert.ok(result !== null);
    assert.strictEqual(result.id, 'OP01-001');
    assert.strictEqual(result.name, 'Monkey D. Luffy');
    assert.strictEqual(result.type, 'Leader');
    assert.strictEqual(result.cost, 5);
    assert.strictEqual(result.power, 5000);
    assert.strictEqual(result.color, 'Red');
    assert.strictEqual(result.effect, 'When this card attacks, draw 1 card.');
    assert.strictEqual(result.attribute, 'Strike');
  });

  it('extracts cost from card_cost and play_cost fallbacks', () => {
    const r1 = normalizeEntry({ id: 'X-001', name: 'A', card_cost: 3 });
    assert.strictEqual(r1?.cost, 3);
    const r2 = normalizeEntry({ id: 'X-001', name: 'A', play_cost: 4 });
    assert.strictEqual(r2?.cost, 4);
  });

  it('extracts power from card_power fallback', () => {
    const r = normalizeEntry({ id: 'X-001', name: 'A', card_power: 6000 });
    assert.strictEqual(r?.power, 6000);
  });

  it('joins color array with slash', () => {
    const r = normalizeEntry({ id: 'X-001', name: 'A', colors: ['Red', 'Blue'] });
    assert.strictEqual(r?.color, 'Red/Blue');
  });

  it('extracts effect from ability, text, card_text, effects fallbacks', () => {
    for (const [field, val] of [['ability', 'ab'], ['text', 'tx'], ['card_text', 'ct'], ['effects', 'ef'], ['card_effect', 'ce']]) {
      const r = normalizeEntry({ id: 'X-001', name: 'A', [field]: val });
      assert.strictEqual(r?.effect, val, `expected effect from field ${field}`);
    }
  });

  it('joins effects array with slash', () => {
    const r = normalizeEntry({ id: 'X-001', name: 'A', effects: ['Rush', 'Blocker'] });
    assert.strictEqual(r?.effect, 'Rush/Blocker');
  });

  it('joins attribute array with slash', () => {
    const r = normalizeEntry({ id: 'X-001', name: 'A', attributes: ['Strike', 'Ranged'] });
    assert.strictEqual(r?.attribute, 'Strike/Ranged');
  });

  it('leaves optional fields null when absent', () => {
    const r = normalizeEntry({ id: 'X-001', name: 'A' });
    assert.ok(r !== null);
    assert.strictEqual(r.cost, null);
    assert.strictEqual(r.power, null);
    assert.strictEqual(r.color, null);
    assert.strictEqual(r.effect, null);
    assert.strictEqual(r.attribute, null);
  });

  it('coerces string cost and power to numbers', () => {
    const r = normalizeEntry({ id: 'X-001', name: 'A', cost: '4', power: '5000' });
    assert.strictEqual(r?.cost, 4);
    assert.strictEqual(r?.power, 5000);
  });
});

describe('getCardDetails', () => {
  it('returns null for unknown card ID', () => {
    assert.strictEqual(getCardDetails('UNKNOWN-999'), null);
  });

  it('returns null for null/undefined input', () => {
    assert.strictEqual(getCardDetails(null), null);
    assert.strictEqual(getCardDetails(undefined), null);
  });

  it('returns a record with name field for known card ID after loadCards', () => {
    const knownIds = ['ST01-001', 'OP01-001'];
    for (const id of knownIds) {
      const details = getCardDetails(id);
      if (details !== null) {
        assert.ok('name' in details, `details for ${id} must have name`);
        assert.ok('type' in details, `details for ${id} must have type`);
        assert.ok('cost' in details, `details for ${id} must have cost`);
        assert.ok('power' in details, `details for ${id} must have power`);
        assert.ok('color' in details, `details for ${id} must have color`);
        assert.ok('effect' in details, `details for ${id} must have effect`);
        assert.ok('attribute' in details, `details for ${id} must have attribute`);
      }
    }
  });
});
