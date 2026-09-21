/**
 * Route shape test for GET /api/games/:id/replay.
 *
 * Injects gamesRoutes with a fake pool and a mock log file to avoid real DB/disk I/O.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { loadCards } from '../src/cards.js';
import { gamesRoutes } from '../src/routes/games.js';

const require = createRequire(import.meta.url);

const TEST_SECRET = 'test-secret-replay';

before(async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  await loadCards();
});

const FAKE_LOG = `Waiting for a Connection with Room ID:RTEST1
Alice#1234 Has Connected
Bob#5678 Has Connected
Version is 1.43a.1
[Alice#1234] Leader is Monkey D. Luffy ["OP01-001">OP01-001]
[Bob#5678] Leader is Roronoa Zoro ["OP01-002">OP01-002]
[Bob#5678] Chose to go Second
[Alice#1234] Deploy Nami ["OP01-016">OP01-016]
[Alice#1234] End Turn
`;

const fakeGame = {
  id: 'replay-test-id',
  user_id: 'user-1',
  raw_log_path: '/fake/path/replay-test.txt',
};

function makeFakePool(game = fakeGame) {
  return {
    query: async (sql) => {
      if (/FROM games/.test(sql)) return { rows: [game] };
      if (/FROM turns/.test(sql)) return { rows: [] };
      if (/FROM coaching_notes/.test(sql)) return { rows: [] };
      return { rows: [] };
    },
  };
}

function makeToken(userId = 'user-1') {
  return jwt.sign({ sub: userId, email: 'test@example.com' }, TEST_SECRET);
}

// Override readFile from fs/promises to avoid real disk access in tests.
// We use the module mock approach: patch the imported module at test time.
// Since ESM modules are cached, we patch the games route by providing a fake
// readFile via the module internals test hook pattern.
// Instead, we test the full route by temporarily creating a temp file.
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('GET /api/games/:id/replay - response shape', () => {
  it('returns 200 with the expected replay structure', async () => {
    // Write a real temp log file so the route can read it
    const tmpPath = join(tmpdir(), `replay-test-${Date.now()}.txt`);
    await writeFile(tmpPath, FAKE_LOG, 'utf8');

    const gameWithTmpPath = { ...fakeGame, raw_log_path: tmpPath };
    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool: makeFakePool(gameWithTmpPath) });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/games/replay-test-id/replay',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    await unlink(tmpPath).catch(() => {});
    await app.close();

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);

    assert.strictEqual(body.gameId, 'replay-test-id');
    assert.ok('player1Username' in body, 'Response must include player1Username');
    assert.ok('player2Username' in body, 'Response must include player2Username');
    assert.ok('player1LeaderId' in body, 'Response must include player1LeaderId');
    assert.ok('player2LeaderId' in body, 'Response must include player2LeaderId');
    assert.ok('turns' in body, 'Response must include turns');
    assert.ok(Array.isArray(body.turns), 'turns must be an array');

    if (body.turns.length > 0) {
      const turn = body.turns[0];
      assert.ok('turn' in turn, 'Each turn must have a turn number');
      assert.ok('activePlayer' in turn, 'Each turn must have activePlayer');
      assert.ok('actions' in turn, 'Each turn must have actions');
      assert.ok('boardAfter' in turn, 'Each turn must have boardAfter');
      assert.ok('player1' in turn.boardAfter, 'boardAfter must have player1');
      assert.ok('player2' in turn.boardAfter, 'boardAfter must have player2');
    }

    assert.strictEqual(body.player1LeaderId, 'OP01-001');
    assert.strictEqual(body.player2LeaderId, 'OP01-002');
  });

  it('returns 404 when game not found', async () => {
    const emptyPool = {
      query: async () => ({ rows: [] }),
    };
    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool: emptyPool });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/games/nonexistent/replay',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    await app.close();
    assert.strictEqual(response.statusCode, 404);
  });

  it('returns 404 when raw_log_path is null', async () => {
    const gameNoLog = { ...fakeGame, raw_log_path: null };
    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool: makeFakePool(gameNoLog) });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/games/replay-test-id/replay',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    await app.close();
    assert.strictEqual(response.statusCode, 404);
  });
});
