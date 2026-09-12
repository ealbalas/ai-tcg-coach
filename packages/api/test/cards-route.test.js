import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { loadCards, getAllCards } from '../src/cards.js';
import { cardsRoutes } from '../src/routes/cards.js';

const TEST_SECRET = 'test-secret';

before(async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  await loadCards();
});

function makeToken() {
  return jwt.sign({ sub: 'user-1', email: 'test@example.com' }, TEST_SECRET);
}

function authHeaders() {
  return { authorization: `Bearer ${makeToken()}` };
}

describe('getAllCards()', () => {
  it('returns an array', () => {
    const cards = getAllCards();
    assert.ok(Array.isArray(cards));
  });

  it('returns entries with id and name fields', () => {
    const cards = getAllCards();
    assert.ok(cards.length > 0, 'Expected at least one cached card after loadCards()');
    for (const card of cards) {
      assert.ok(typeof card.id === 'string', 'id must be a string');
      assert.ok(typeof card.name === 'string', 'name must be a string');
    }
  });

  it('returns cards sorted by id', () => {
    const cards = getAllCards();
    for (let i = 1; i < cards.length; i++) {
      assert.ok(
        cards[i - 1].id.localeCompare(cards[i].id) <= 0,
        `Expected cards sorted by id but ${cards[i - 1].id} > ${cards[i].id}`,
      );
    }
  });
});

describe('GET /api/cards', () => {
  it('returns all cards with cards and total fields', async () => {
    const app = Fastify({ logger: false });
    await app.register(cardsRoutes);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/cards', headers: authHeaders() });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok('cards' in body, 'Response must include cards');
    assert.ok('total' in body, 'Response must include total');
    assert.ok(Array.isArray(body.cards));
    assert.strictEqual(body.total, body.cards.length);
    assert.ok(body.total > 0, 'Expected at least one card returned');

    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = Fastify({ logger: false });
    await app.register(cardsRoutes);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/cards' });
    assert.strictEqual(res.statusCode, 401);

    await app.close();
  });

  it('filters by name with ?q=', async () => {
    const allCards = getAllCards();
    const sampleName = allCards[0]?.name;
    if (!sampleName) return;
    const firstWord = sampleName.split(' ')[0];

    const app = Fastify({ logger: false });
    await app.register(cardsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/api/cards?q=${encodeURIComponent(firstWord)}`,
      headers: authHeaders(),
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.cards.every((c) =>
      c.name.toLowerCase().includes(firstWord.toLowerCase()),
    ), 'All returned cards must match the name filter');
    assert.strictEqual(body.total, body.cards.length);

    await app.close();
  });

  it('filters by type with ?type= (case-insensitive)', async () => {
    const app = Fastify({ logger: false });
    await app.register(cardsRoutes);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/cards?type=Leader', headers: authHeaders() });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    for (const card of body.cards) {
      assert.strictEqual(
        card.type?.toLowerCase(), 'leader',
        `Expected type=Leader but got ${card.type}`,
      );
    }

    await app.close();
  });

  it('filters by color with ?color= (contains, case-insensitive)', async () => {
    const allCards = getAllCards();
    const withColor = allCards.find((c) => c.color != null);
    if (!withColor || !withColor.color) return;
    const colorFragment = withColor.color.split('/')[0];

    const app = Fastify({ logger: false });
    await app.register(cardsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/api/cards?color=${encodeURIComponent(colorFragment)}`,
      headers: authHeaders(),
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    for (const card of body.cards) {
      assert.ok(
        card.color?.toLowerCase().includes(colorFragment.toLowerCase()),
        `Expected color to contain "${colorFragment}" but got "${card.color}"`,
      );
    }

    await app.close();
  });

  it('returns empty array when no cards match', async () => {
    const app = Fastify({ logger: false });
    await app.register(cardsRoutes);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/cards?q=ZZZNOMATCH999ZZZNOMATCH',
      headers: authHeaders(),
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepStrictEqual(body.cards, []);
    assert.strictEqual(body.total, 0);

    await app.close();
  });
});
