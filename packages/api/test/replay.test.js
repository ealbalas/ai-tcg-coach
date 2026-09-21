/**
 * Unit tests for the replay builder (packages/api/src/replay.js).
 *
 * Uses synthetic log strings that follow the confirmed OPTCGSim format documented
 * in AGENTS.md and verified against real match logs.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadCards } from '../src/cards.js';
import { buildReplay } from '../src/replay.js';

const BASE_HEADER = `Waiting for a Connection with Room ID:REPLAY1
Alice#1234 Has Connected
Bob#5678 Has Connected
Version is 1.43a.1
[Alice#1234] Leader is Monkey D. Luffy ["OP01-001">OP01-001]
[Bob#5678] Leader is Roronoa Zoro ["OP01-002">OP01-002]
[Bob#5678] Chose to go Second
`;

before(async () => {
  await loadCards();
});

describe('buildReplay - setup-only log (RZ1 lines only)', () => {
  it('returns correct player info and leader IDs', () => {
    const log = BASE_HEADER + 'RZ1|1|1|OP01-016|0|0|0|0|0|0|0|0|0\nRZ1|CHK|1|1|50|0|0|0|10|0|0|0|0|0\n';
    const replay = buildReplay(log, 1);
    assert.strictEqual(replay.gameId, 1);
    assert.strictEqual(replay.player1Username, 'Alice#1234');
    assert.strictEqual(replay.player2Username, 'Bob#5678');
    assert.strictEqual(replay.player1LeaderId, 'OP01-001');
    assert.strictEqual(replay.player2LeaderId, 'OP01-002');
    assert.strictEqual(replay.winner, null);
  });

  it('produces one turn per player-change block from RZ1 lines', () => {
    const log = BASE_HEADER
      + 'RZ1|1|1|OP01-016|0|0|0|0|0|0|0|0|0\n'
      + 'RZ1|CHK|1|1|50|0|0|0|10|0|0|0|0|0\n'
      + 'RZ1|2|2|OP01-030|0|0|0|0|0|0|0|0|0\n'
      + 'RZ1|CHK|2|2|50|0|0|0|10|0|0|0|0|0\n';
    const replay = buildReplay(log);
    assert.strictEqual(replay.turns.length, 2);
    assert.strictEqual(replay.turns[0].turn, 1);
    assert.strictEqual(replay.turns[0].activePlayer, 1);
    assert.strictEqual(replay.turns[1].turn, 2);
    assert.strictEqual(replay.turns[1].activePlayer, 2);
  });

  it('each turn includes a boardAfter snapshot', () => {
    const log = BASE_HEADER + 'RZ1|1|1|OP01-016|0|0|0|0|0|0|0|0|0\n';
    const replay = buildReplay(log);
    assert.ok(replay.turns.length > 0);
    const { boardAfter } = replay.turns[0];
    assert.ok(boardAfter.player1, 'boardAfter must have player1');
    assert.ok(boardAfter.player2, 'boardAfter must have player2');
    assert.ok(typeof boardAfter.player1.life === 'number');
    assert.ok(typeof boardAfter.player1.handCount === 'number');
  });
});

describe('buildReplay - gameplay text lines', () => {
  // Turn 1: Alice deploys, attaches DON!!, attacks, then snapshots appear before her End Turn.
  // Turn 2: Bob deploys, then End Turn appears before snapshots (tests both snapshot orderings).
  const GAMEPLAY_LOG = BASE_HEADER
    + '[Alice#1234] Deploy Nami ["OP01-016">OP01-016]\n'
    + '[Alice#1234] Attach 2 Don to Nami ["OP01-016">OP01-016] (2 Total)\n'
    + '[Alice#1234] Nami ["OP01-016">OP01-016] attacking Bob ["OP01-002">OP01-002]\n'
    + '[Alice#1234] Hand: [OP01-020]\n'
    + '[Alice#1234] Board: [OP01-016]\n'
    + '[Alice#1234] Trash: []\n'
    + '[Alice#1234] Life: 5\n'
    + '[Bob#5678] Hand: [OP01-030,OP01-031]\n'
    + '[Bob#5678] Board: []\n'
    + '[Bob#5678] Trash: []\n'
    + '[Bob#5678] Life: 5\n'
    + '[Alice#1234] End Turn\n'
    + '[Bob#5678] Deploy Nico Robin ["OP01-030">OP01-030]\n'
    + '[Bob#5678] End Turn\n'
    + '[Alice#1234] Hand: [OP01-020]\n'
    + '[Alice#1234] Board: [OP01-016]\n'
    + '[Alice#1234] Trash: []\n'
    + '[Alice#1234] Life: 5\n'
    + '[Bob#5678] Hand: [OP01-031]\n'
    + '[Bob#5678] Board: [OP01-030]\n'
    + '[Bob#5678] Trash: []\n'
    + '[Bob#5678] Life: 5\n';

  it('detects turn boundaries from End Turn markers', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    assert.strictEqual(replay.turns.length, 2);
    assert.strictEqual(replay.turns[0].turn, 1);
    assert.strictEqual(replay.turns[1].turn, 2);
  });

  it('assigns activePlayer=1 to the first turn when player1 goes first', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    // Bob chose to go second, so Alice (player 1) goes first
    assert.strictEqual(replay.turns[0].activePlayer, 1);
    assert.strictEqual(replay.turns[1].activePlayer, 2);
  });

  it('records deploy action in the action log', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    const turn1Actions = replay.turns[0].actions;
    assert.ok(turn1Actions.some((a) => a.includes('Deploy') || a.includes('Deployed')),
      `Expected a deploy entry in: ${JSON.stringify(turn1Actions)}`);
  });

  it('tracks deployed character on the board via end-of-turn snapshot', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    const p1After = replay.turns[0].boardAfter.player1;
    assert.ok(
      p1After.characters.some((c) => c.id === 'OP01-016'),
      `Expected OP01-016 in characters: ${JSON.stringify(p1After.characters)}`,
    );
  });

  it('records DON!! attach in the action log', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    const turn1Actions = replay.turns[0].actions;
    assert.ok(turn1Actions.some((a) => a.includes('DON!!')),
      `Expected a DON!! entry in: ${JSON.stringify(turn1Actions)}`);
  });

  it('tracks DON!! count on the attached character', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    const p1After = replay.turns[0].boardAfter.player1;
    const nami = p1After.characters.find((c) => c.id === 'OP01-016');
    assert.ok(nami, 'Nami must be on board after turn 1');
    assert.strictEqual(nami.donAttached, 2);
  });

  it('records attack action in the action log', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    const turn1Actions = replay.turns[0].actions;
    assert.ok(turn1Actions.some((a) => /attack/i.test(a)),
      `Expected an attack entry in: ${JSON.stringify(turn1Actions)}`);
  });

  it('marks attacking character as rested (active: false)', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    const p1After = replay.turns[0].boardAfter.player1;
    const nami = p1After.characters.find((c) => c.id === 'OP01-016');
    assert.ok(nami, 'Nami must be on board');
    assert.strictEqual(nami.active, false, 'Attacker should be rested after attack');
  });

  it('player 2 deploys a character in turn 2', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    const p2After = replay.turns[1].boardAfter.player2;
    assert.ok(
      p2After.characters.some((c) => c.id === 'OP01-030'),
      `Expected OP01-030 in player2 characters: ${JSON.stringify(p2After.characters)}`,
    );
  });

  it('life count is set from snapshot', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    assert.strictEqual(replay.turns[0].boardAfter.player1.life, 5);
    assert.strictEqual(replay.turns[0].boardAfter.player2.life, 5);
  });

  it('hand cards are populated from snapshot', () => {
    const replay = buildReplay(GAMEPLAY_LOG);
    const p1After = replay.turns[0].boardAfter.player1;
    assert.ok(p1After.hand.some((c) => c.id === 'OP01-020'),
      `Expected OP01-020 in hand: ${JSON.stringify(p1After.hand)}`);
    assert.strictEqual(p1After.handCount, 1);
  });
});

describe('buildReplay - winner detection', () => {
  it('names player 2 as winner when player 1 disconnects', () => {
    const log = BASE_HEADER + 'Alice#1234 Has Disconnected\n';
    const replay = buildReplay(log);
    assert.strictEqual(replay.winner, 'Bob#5678');
  });

  it('names player 1 as winner when player 2 disconnects', () => {
    const log = BASE_HEADER + 'Bob#5678 Has Disconnected\n';
    const replay = buildReplay(log);
    assert.strictEqual(replay.winner, 'Alice#1234');
  });
});
