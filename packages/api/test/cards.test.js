import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadCards, getCardName, getCardDetails, normalizeEntry, getAllCards, backgroundRefresh } from '../src/cards.js';

describe('cards module', () => {
  before(() => {
    // loadCards() is synchronous - loads from the bundled cards.json snapshot
    loadCards();
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
    // Test a set of IDs present in the bundled cards.json snapshot.
    const knownIds = [
      'ST01-001', 'ST02-001', 'ST03-001',
      'OP01-001', 'OP01-002', 'OP01-060',
    ];
    const hits = knownIds.filter((id) => getCardName(id) !== null);
    // At least some should resolve - if zero hits, the bundle failed to load
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

  it('loadCards populates a large card set from the bundled snapshot', () => {
    // The bundle (src/data/cards.json) has thousands of cards - verify it loaded
    const cards = getAllCards();
    assert.ok(cards.length > 1000, `Expected >1000 cards from bundle, got ${cards.length}`);
  });

  it('getAllCards returns cards with required fields from the bundle', () => {
    const cards = getAllCards();
    assert.ok(cards.length > 0, 'getAllCards must return at least one card');
    const first = cards[0];
    assert.ok(typeof first.id === 'string' && first.id.length > 0, 'card must have id');
    assert.ok(typeof first.name === 'string' && first.name.length > 0, 'card must have name');
    assert.ok('type' in first, 'card must have type field');
    assert.ok('cost' in first, 'card must have cost field');
    assert.ok('power' in first, 'card must have power field');
    assert.ok('color' in first, 'card must have color field');
  });

  it('getAllCards returns cards sorted by id', () => {
    const cards = getAllCards();
    for (let i = 1; i < Math.min(cards.length, 100); i++) {
      assert.ok(
        cards[i - 1].id.localeCompare(cards[i].id) <= 0,
        `Cards not sorted at index ${i}: ${cards[i - 1].id} > ${cards[i].id}`,
      );
    }
  });

  it('backgroundRefresh adds new cards without removing existing ones', async () => {
    const originalFetch = globalThis.fetch;
    const UNIQUE_REFRESH_ID = 'REFRESH-TEST-UNIQUE-XYZ-001';
    const existingCard = getAllCards()[0];
    assert.ok(existingCard, 'Need at least one existing card for this test');

    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('api.github.com')) {
        return { ok: true, json: async () => [{ name: 'REFRESH-TEST.json' }] };
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            code: 'REFRESH-TEST',
            cards: [
              { id: UNIQUE_REFRESH_ID, name: 'Brand New Card', class: 'CHARACTER', color: ['Green'] },
            ],
          },
        }),
      };
    };
    try {
      await backgroundRefresh();
      // New card from refresh should be present
      assert.strictEqual(getCardName(UNIQUE_REFRESH_ID), 'Brand New Card',
        'backgroundRefresh must add new cards from the remote source');
      // Existing cards from bundle must not be removed
      assert.strictEqual(getCardName(existingCard.id), existingCard.name,
        'backgroundRefresh must not remove existing bundle cards');
    } finally {
      globalThis.fetch = originalFetch;
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
        assert.ok('image' in details, `details for ${id} must have image`);
      }
    }
  });
});

describe('normalizeEntry - hugoprudente/optcgjson format', () => {
  it('prefers class over type for card type', () => {
    const entry = {
      id: 'OP01-001',
      name: 'Roronoa Zoro',
      type: 'L',
      class: 'LEADER',
    };
    const result = normalizeEntry(entry);
    assert.ok(result !== null);
    assert.strictEqual(result.type, 'LEADER', 'class field should be preferred over type short code');
  });

  it('joins color array with slash', () => {
    const entry = { id: 'OP01-001', name: 'Zoro', color: ['Red', 'Blue'] };
    const result = normalizeEntry(entry);
    assert.strictEqual(result?.color, 'Red/Blue');
  });

  it('extracts image from image_url field', () => {
    const imageUrl = 'https://asia-en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png';
    const entry = { id: 'OP01-001', name: 'Zoro', image_url: imageUrl };
    const result = normalizeEntry(entry);
    assert.strictEqual(result?.image, imageUrl);
  });

  it('extracts image from image field fallback', () => {
    const imageUrl = 'https://example.com/card.png';
    const entry = { id: 'OP01-001', name: 'Zoro', image: imageUrl };
    const result = normalizeEntry(entry);
    assert.strictEqual(result?.image, imageUrl);
  });

  it('returns null image when no image field present', () => {
    const entry = { id: 'OP01-001', name: 'Zoro' };
    const result = normalizeEntry(entry);
    assert.strictEqual(result?.image, null);
  });

  it('handles full hugoprudente card entry correctly', () => {
    const entry = {
      id: 'OP01-001',
      type: 'L',
      class: 'LEADER',
      name: 'Roronoa Zoro',
      cost: 'Life5',
      power: '5000',
      color: ['Red'],
      attribute: ['Slash'],
      effect: '[DON!! x1] [Your Turn] attack',
      image_url: 'https://asia-en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png',
    };
    const result = normalizeEntry(entry);
    assert.ok(result !== null);
    assert.strictEqual(result.id, 'OP01-001');
    assert.strictEqual(result.name, 'Roronoa Zoro');
    assert.strictEqual(result.type, 'LEADER');
    assert.strictEqual(result.color, 'Red');
    assert.strictEqual(result.attribute, 'Slash');
    assert.strictEqual(result.effect, '[DON!! x1] [Your Turn] attack');
    assert.strictEqual(result.image, 'https://asia-en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png');
    // 'Life5' is not a parseable integer
    assert.strictEqual(result.cost, null);
    assert.strictEqual(result.power, 5000);
  });

  it('uses number field as id fallback', () => {
    const entry = { number: 'OP01-002', name: 'Luffy' };
    const result = normalizeEntry(entry);
    assert.ok(result !== null);
    assert.strictEqual(result.id, 'OP01-002');
  });
});
