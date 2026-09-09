/**
 * Tests for the LLM coaching pipeline:
 * - buildCoachingSummary shape
 * - GET /api/games/:id/coaching-status endpoint
 * - LLM notes (layer='llm') returned by GET /api/games/:id
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { loadCards } from '../src/cards.js';
import { buildCoachingSummary } from '../src/routes/games.js';
import { gamesRoutes } from '../src/routes/games.js';

const TEST_SECRET = 'test-secret';

before(async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  await loadCards();
});

function makeToken(userId = 'user-1') {
  return jwt.sign({ sub: userId, email: 'test@example.com' }, TEST_SECRET);
}

// --- buildCoachingSummary ---

function makeParsed({ player1Leader = 'ST01-001', player2Leader = 'ST02-001', turns = [] } = {}) {
  return { player1Leader, player2Leader, player1GoesFirst: true, version: '1.0', roomId: 'T', turns };
}

function makeTurnData(turnNumber, player, cardIds) {
  return {
    turnNumber,
    player,
    actions: cardIds.map((cardId, i) => ({ seq: i + 1, cardId, player })),
    lastBoardState: {},
  };
}

describe('buildCoachingSummary', () => {
  it('returns correct top-level shape', () => {
    const parsed = makeParsed({ turns: [makeTurnData(1, 1, ['OP01-001', 'OP01-002'])] });
    const summary = buildCoachingSummary(parsed, 1);

    assert.ok('myLeader' in summary, 'must have myLeader');
    assert.ok('oppLeader' in summary, 'must have oppLeader');
    assert.ok('myPlayerNumber' in summary, 'must have myPlayerNumber');
    assert.ok('turns' in summary, 'must have turns');

    assert.strictEqual(summary.myLeader.id, 'ST01-001');
    assert.strictEqual(summary.oppLeader.id, 'ST02-001');
    assert.strictEqual(summary.myPlayerNumber, 1);
  });

  it('turns have isMyTurn set correctly', () => {
    const parsed = makeParsed({
      turns: [makeTurnData(1, 1, ['OP01-001']), makeTurnData(2, 2, ['OP01-002'])],
    });
    const summary = buildCoachingSummary(parsed, 1);

    assert.strictEqual(summary.turns.length, 2);
    assert.strictEqual(summary.turns[0].isMyTurn, true);
    assert.strictEqual(summary.turns[1].isMyTurn, false);
  });

  it('each turn card has id and name fields', () => {
    const parsed = makeParsed({ turns: [makeTurnData(1, 1, ['ST01-001', 'UNKNOWN-999'])] });
    const summary = buildCoachingSummary(parsed, 1);

    const cards = summary.turns[0].cards;
    assert.strictEqual(cards.length, 2);
    for (const card of cards) {
      assert.ok('id' in card, 'card must have id');
      assert.ok('name' in card, 'card must have name');
    }
    // ST01-001 should resolve from fallback or remote
    assert.ok(
      cards[0].name === null || typeof cards[0].name === 'string',
      'name must be string or null',
    );
    // UNKNOWN-999 should resolve to null
    assert.strictEqual(cards[1].name, null);
  });

  it('works with no turns', () => {
    const parsed = makeParsed({ turns: [] });
    const summary = buildCoachingSummary(parsed, 1);
    assert.deepStrictEqual(summary.turns, []);
  });

  it('works with null leader IDs', () => {
    const parsed = makeParsed({ player1Leader: null, player2Leader: null, turns: [] });
    const summary = buildCoachingSummary(parsed, 1);
    assert.strictEqual(summary.myLeader.id, null);
    assert.strictEqual(summary.myLeader.name, null);
    assert.strictEqual(summary.oppLeader.id, null);
    assert.strictEqual(summary.oppLeader.name, null);
  });
});

// --- GET /api/games/:id/coaching-status ---

const baseGame = {
  id: 'game-1',
  user_id: 'user-1',
  uploaded_at: new Date().toISOString(),
  played_at: null,
  my_leader_card_id: 'ST01-001',
  opp_leader_card_id: 'ST02-001',
  went_first: true,
  result: 'unknown',
  coaching_status: 'analyzing',
  optcgsim_version: '1.0',
  room_id: 'ROOM',
  raw_log_path: null,
};

function makePoolWithStatus(status) {
  return {
    query: async (sql) => {
      if (/coaching_status.*FROM games/.test(sql) || /FROM games.*coaching_status/.test(sql)) {
        return { rows: [{ coaching_status: status }] };
      }
      if (/FROM games/.test(sql)) return { rows: [{ ...baseGame, coaching_status: status }] };
      if (/FROM turns/.test(sql)) return { rows: [] };
      if (/FROM coaching_notes/.test(sql)) return { rows: [] };
      return { rows: [] };
    },
  };
}

describe('GET /api/games/:id/coaching-status', () => {
  for (const status of ['pending', 'analyzing', 'done', 'error']) {
    it(`returns coaching_status=${status}`, async () => {
      const app = Fastify({ logger: false });
      await app.register(gamesRoutes, { pool: makePoolWithStatus(status) });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/games/game-1/coaching-status',
        headers: { authorization: `Bearer ${makeToken()}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.coaching_status, status);

      await app.close();
    });
  }

  it('returns 404 when game not found', async () => {
    const pool = {
      query: async () => ({ rows: [] }),
    };
    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/games/nonexistent/coaching-status',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    assert.strictEqual(res.statusCode, 404);
    await app.close();
  });
});

// --- LLM notes in GET /api/games/:id ---

describe('GET /api/games/:id - LLM notes', () => {
  it('returns coaching notes with layer=llm', async () => {
    const llmNote = {
      id: 'note-1',
      game_id: 'game-1',
      turn_id: null,
      layer: 'llm',
      severity: 'info',
      text: 'Overall assessment from AI.',
      created_at: new Date().toISOString(),
    };

    const pool = {
      query: async (sql) => {
        if (/FROM games/.test(sql)) return { rows: [baseGame] };
        if (/FROM turns/.test(sql)) return { rows: [] };
        if (/FROM coaching_notes/.test(sql)) return { rows: [llmNote] };
        return { rows: [] };
      },
    };

    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/games/game-1',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.coaching_notes), 'coaching_notes must be array');
    assert.strictEqual(body.coaching_notes.length, 1);
    assert.strictEqual(body.coaching_notes[0].layer, 'llm');
    assert.strictEqual(body.coaching_notes[0].text, 'Overall assessment from AI.');

    await app.close();
  });

  it('returns both rule and llm notes together', async () => {
    const ruleNote = {
      id: 'note-rule',
      game_id: 'game-1',
      turn_id: null,
      layer: 'rule',
      severity: 'info',
      text: 'Rule-based tip.',
      created_at: new Date().toISOString(),
    };
    const llmNote = {
      id: 'note-llm',
      game_id: 'game-1',
      turn_id: null,
      layer: 'llm',
      severity: 'info',
      text: 'LLM tip.',
      created_at: new Date().toISOString(),
    };

    const pool = {
      query: async (sql) => {
        if (/FROM games/.test(sql)) return { rows: [baseGame] };
        if (/FROM turns/.test(sql)) return { rows: [] };
        if (/FROM coaching_notes/.test(sql)) return { rows: [ruleNote, llmNote] };
        return { rows: [] };
      },
    };

    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/games/game-1',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.coaching_notes.length, 2);
    const layers = body.coaching_notes.map((n) => n.layer);
    assert.ok(layers.includes('rule'), 'must include rule note');
    assert.ok(layers.includes('llm'), 'must include llm note');

    await app.close();
  });
});

// --- Actions enriched with cardName in GET /api/games/:id ---

describe('GET /api/games/:id - actions enriched with cardName', () => {
  it('actions_json includes cardName field', async () => {
    const turnWithActions = {
      id: 'turn-1',
      game_id: 'game-1',
      turn_number: 1,
      player: 1,
      actions_json: [{ seq: 1, cardId: 'ST01-001', player: 1 }],
      board_state_json: {},
    };

    const pool = {
      query: async (sql) => {
        if (/FROM games/.test(sql)) return { rows: [baseGame] };
        if (/FROM turns/.test(sql)) return { rows: [turnWithActions] };
        if (/FROM coaching_notes/.test(sql)) return { rows: [] };
        return { rows: [] };
      },
    };

    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/games/game-1',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.turns.length, 1);
    const actions = body.turns[0].actions_json;
    assert.ok(Array.isArray(actions), 'actions_json must be array');
    assert.strictEqual(actions.length, 1);
    assert.ok('cardName' in actions[0], 'action must have cardName field');
    assert.strictEqual(actions[0].cardId, 'ST01-001');

    await app.close();
  });

  it('cardName is null for unknown card IDs', async () => {
    const turnWithUnknown = {
      id: 'turn-1',
      game_id: 'game-1',
      turn_number: 1,
      player: 1,
      actions_json: [{ seq: 1, cardId: 'ZZ99-999', player: 1 }],
      board_state_json: {},
    };

    const pool = {
      query: async (sql) => {
        if (/FROM games/.test(sql)) return { rows: [baseGame] };
        if (/FROM turns/.test(sql)) return { rows: [turnWithUnknown] };
        if (/FROM coaching_notes/.test(sql)) return { rows: [] };
        return { rows: [] };
      },
    };

    const app = Fastify({ logger: false });
    await app.register(gamesRoutes, { pool });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/games/game-1',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    const actions = body.turns[0].actions_json;
    assert.strictEqual(actions[0].cardName, null);

    await app.close();
  });
});
