/**
 * Route shape test: verifies GET /api/games/:id includes my_leader_name and opp_leader_name.
 *
 * Uses the real gamesRoutes handler with a fake pool injected via plugin opts.
 * JWT_SECRET is set to a known value so authenticate works without a real database.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { loadCards } from '../src/cards.js';
import { gamesRoutes } from '../src/routes/games.js';

const TEST_SECRET = 'test-secret';

before(async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  await loadCards();
});

const fakeGame = {
  id: 'test-id',
  user_id: 'user-1',
  uploaded_at: new Date().toISOString(),
  played_at: null,
  my_leader_card_id: 'ST01-001',
  opp_leader_card_id: 'ST02-001',
  went_first: true,
  result: 'unknown',
  coaching_status: 'heuristic_complete',
  optcgsim_version: '1.0',
  room_id: 'ROOM1',
  raw_log_path: null,
};

function makeFakePool(gameRow = fakeGame) {
  return {
    query: async (sql) => {
      if (/FROM games/.test(sql)) return { rows: [gameRow] };
      if (/FROM turns/.test(sql)) return { rows: [] };
      if (/FROM coaching_notes/.test(sql)) return { rows: [] };
      return { rows: [] };
    },
  };
}

function makeToken(userId = 'user-1') {
  return jwt.sign({ sub: userId, email: 'test@example.com' }, TEST_SECRET);
}

describe('GET /api/games/:id - response shape contract', () => {
  it('response includes my_leader_name and opp_leader_name at the top level', async () => {
    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool: makeFakePool() });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/games/test-id',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);

    assert.ok('my_leader_name' in body, 'Response must include my_leader_name');
    assert.ok('opp_leader_name' in body, 'Response must include opp_leader_name');
    assert.ok('game' in body, 'Response must include game');
    assert.ok('turns' in body, 'Response must include turns');
    assert.ok('coaching_notes' in body, 'Response must include coaching_notes');

    const myName = body.my_leader_name;
    const oppName = body.opp_leader_name;
    assert.ok(
      myName === null || typeof myName === 'string',
      `my_leader_name must be string|null, got: ${typeof myName}`,
    );
    assert.ok(
      oppName === null || typeof oppName === 'string',
      `opp_leader_name must be string|null, got: ${typeof oppName}`,
    );

    await app.close();
  });

  it('my_leader_name is null for unknown card IDs', async () => {
    const unknownGame = { ...fakeGame, my_leader_card_id: 'ZZ99-999', opp_leader_card_id: null };
    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool: makeFakePool(unknownGame) });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/games/test-id',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.my_leader_name, null);
    assert.strictEqual(body.opp_leader_name, null);

    await app.close();
  });
});
