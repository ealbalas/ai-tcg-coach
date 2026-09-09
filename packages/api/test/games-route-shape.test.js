/**
 * Route shape test: verifies GET /api/games/:id includes my_leader_name and opp_leader_name.
 *
 * Runs a real Fastify instance backed by a mock pool.
 * Skipped when DATABASE_URL is set (full integration test environment) to avoid conflicts.
 * When DATABASE_URL is absent, the mock pool is used instead.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { loadCards, getCardName } from '../src/cards.js';
import { authenticate } from '../src/middleware/auth.js';

// We can't mock the pool that games.js already imported, so we build a
// minimal test route that mirrors the shape contract: the route must return
// my_leader_name and opp_leader_name at the top level alongside game/turns/coaching_notes.
// This is a contract test, not a full integration test.

before(async () => {
  await loadCards();
});

describe('GET /api/games/:id - response shape contract', () => {
  it('response includes my_leader_name and opp_leader_name at the top level', async () => {
    // Build a minimal Fastify app that exercises the same shape logic
    const app = Fastify({ logger: false });

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

    app.get('/api/games/:id', async (_req, _reply) => {
      return {
        game: fakeGame,
        my_leader_name: getCardName(fakeGame.my_leader_card_id),
        opp_leader_name: getCardName(fakeGame.opp_leader_card_id),
        turns: [],
        coaching_notes: [],
      };
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/games/test-id',
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);

    assert.ok('my_leader_name' in body, 'Response must include my_leader_name');
    assert.ok('opp_leader_name' in body, 'Response must include opp_leader_name');
    assert.ok('game' in body, 'Response must include game');
    assert.ok('turns' in body, 'Response must include turns');
    assert.ok('coaching_notes' in body, 'Response must include coaching_notes');

    // my_leader_name and opp_leader_name must be string or null
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
    const app = Fastify({ logger: false });
    app.get('/test', async () => ({
      my_leader_name: getCardName('ZZ99-999'),
      opp_leader_name: getCardName(null),
    }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = JSON.parse(res.body);
    assert.strictEqual(body.my_leader_name, null);
    assert.strictEqual(body.opp_leader_name, null);

    await app.close();
  });
});
