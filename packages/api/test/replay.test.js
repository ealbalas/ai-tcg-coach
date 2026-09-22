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

describe('buildReplay - pendingEndTurn state isolation', () => {
  // End Turn arrives before snapshots; Turn 2 events must not bleed into Turn 1.
  const INTERLEAVED_LOG = BASE_HEADER
    + '[Alice#1234] Deploy Nami ["OP01-016">OP01-016]\n'
    + '[Alice#1234] End Turn\n'
    + '[Bob#5678] Deploy Nico Robin ["OP01-030">OP01-030]\n'
    + '[Alice#1234] Hand: [OP01-020]\n'
    + '[Alice#1234] Board: [OP01-016]\n'
    + '[Alice#1234] Trash: []\n'
    + '[Alice#1234] Life: 5\n'
    + '[Bob#5678] Hand: [OP01-031]\n'
    + '[Bob#5678] Board: []\n'
    + '[Bob#5678] Trash: []\n'
    + '[Bob#5678] Life: 5\n';

  it("turn 1 actions contain only Alice's deploy, not Bob's Turn-2 deploy", () => {
    const replay = buildReplay(INTERLEAVED_LOG);
    const turn1Actions = replay.turns[0].actions;
    assert.ok(
      turn1Actions.some((a) => /Nami|OP01-016/i.test(a)),
      `Turn 1 must include Alice's deploy: ${JSON.stringify(turn1Actions)}`,
    );
    assert.ok(
      !turn1Actions.some((a) => /Robin|OP01-030/i.test(a)),
      `Turn 1 must NOT include Bob's Turn-2 deploy: ${JSON.stringify(turn1Actions)}`,
    );
  });

  it("rested state from Turn 2 does not bleed into Turn 1's board snapshot", () => {
    // Bob attacks with OP01-030 during Turn 2; Turn 1 snapshots arrive after.
    // Without the fix, OP01-030 ends up in restedCards when Turn 1's board is built.
    const RESTED_BLEED_LOG = BASE_HEADER
      + '[Alice#1234] End Turn\n'
      + '[Bob#5678] Nico Robin ["OP01-030">OP01-030] attacking Alice ["OP01-001">OP01-001]\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 4\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: [OP01-030]\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n';
    const replay = buildReplay(RESTED_BLEED_LOG);
    const p2After = replay.turns[0].boardAfter.player2;
    const robin = p2After.characters.find((c) => c.id === 'OP01-030');
    assert.ok(robin, 'Nico Robin must appear in Turn 1 board snapshot');
    assert.strictEqual(robin.active, true, 'Robin attacked in Turn 2; it must be active in Turn 1 snapshot');
  });
});

describe('buildReplay - cross-player card-ID isolation', () => {
  it('rested state from one player does not mark same card ID as rested for the other player', () => {
    // Both players have OP01-016 on their board; only Alice attacks with it.
    const log = BASE_HEADER
      + '[Alice#1234] Deploy Nami ["OP01-016">OP01-016]\n'
      + '[Bob#5678] Deploy Nami ["OP01-016">OP01-016]\n'
      + '[Alice#1234] Nami ["OP01-016">OP01-016] attacking Bob ["OP01-002">OP01-002]\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: [OP01-016]\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: [OP01-016]\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n';
    const replay = buildReplay(log);
    const p1After = replay.turns[0].boardAfter.player1;
    const p2After = replay.turns[0].boardAfter.player2;
    const aliceNami = p1After.characters.find((c) => c.id === 'OP01-016');
    const bobNami = p2After.characters.find((c) => c.id === 'OP01-016');
    assert.ok(aliceNami, 'Alice must have OP01-016');
    assert.ok(bobNami, 'Bob must have OP01-016');
    assert.strictEqual(aliceNami.active, false, 'Alice attacked - her Nami must be rested');
    assert.strictEqual(bobNami.active, true, 'Bob did not attack - his Nami must be active');
  });

  it('DON!! on one player does not bleed to same card ID on the other player', () => {
    // Both players have OP01-016; only Alice attaches DON!! to hers.
    const log = BASE_HEADER
      + '[Alice#1234] Deploy Nami ["OP01-016">OP01-016]\n'
      + '[Bob#5678] Deploy Nami ["OP01-016">OP01-016]\n'
      + '[Alice#1234] Attach 3 Don to Nami ["OP01-016">OP01-016] (3 Total)\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: [OP01-016]\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: [OP01-016]\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n';
    const replay = buildReplay(log);
    const p1After = replay.turns[0].boardAfter.player1;
    const p2After = replay.turns[0].boardAfter.player2;
    const aliceNami = p1After.characters.find((c) => c.id === 'OP01-016');
    const bobNami = p2After.characters.find((c) => c.id === 'OP01-016');
    assert.ok(aliceNami, 'Alice must have OP01-016');
    assert.ok(bobNami, 'Bob must have OP01-016');
    assert.strictEqual(aliceNami.donAttached, 3, 'Alice attached 3 DON!!');
    assert.strictEqual(bobNami.donAttached, 0, "Bob's Nami must have 0 DON!!");
  });
});

describe('buildReplay - DON!! pendingEndTurn state isolation', () => {
  it("DON!! attached in Turn 2 does not bleed into Turn 1's board snapshot", () => {
    // Alice End Turn before snapshots; Bob attaches DON!! in Turn 2 before Turn 1 snapshots arrive.
    const DON_BLEED_LOG = BASE_HEADER
      + '[Alice#1234] End Turn\n'
      + '[Bob#5678] Deploy Nico Robin ["OP01-030">OP01-030]\n'
      + '[Bob#5678] Attach 2 Don to Nico Robin ["OP01-030">OP01-030] (2 Total)\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: [OP01-030]\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n';
    const replay = buildReplay(DON_BLEED_LOG);
    const p2After = replay.turns[0].boardAfter.player2;
    const robin = p2After.characters.find((c) => c.id === 'OP01-030');
    assert.ok(robin, 'Nico Robin must appear in Turn 1 board snapshot');
    assert.strictEqual(robin.donAttached, 0, 'Robin had 0 DON!! at end of Turn 1; Turn 2 attachment must not bleed in');
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

describe('buildReplay - stage zone population', () => {
  // EB01-011 is "Mini-Merry" with type "STAGE" (uppercase) in cards.json
  it('places a STAGE-type card in stage, not characters', () => {
    const log = BASE_HEADER
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: [EB01-011]\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n';
    const replay = buildReplay(log);
    const p1After = replay.turns[0].boardAfter.player1;
    assert.ok(
      p1After.stage.some((c) => c.id === 'EB01-011'),
      `Expected EB01-011 in stage: ${JSON.stringify(p1After.stage)}`,
    );
    assert.ok(
      !p1After.characters.some((c) => c.id === 'EB01-011'),
      `EB01-011 must NOT appear in characters: ${JSON.stringify(p1After.characters)}`,
    );
  });

  it('keeps non-stage cards out of the stage array', () => {
    const log = BASE_HEADER
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: [OP01-016]\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n';
    const replay = buildReplay(log);
    const p1After = replay.turns[0].boardAfter.player1;
    assert.strictEqual(p1After.stage.length, 0, 'Character card must not appear in stage');
    assert.ok(
      p1After.characters.some((c) => c.id === 'OP01-016'),
      'Character card must appear in characters',
    );
  });
});

describe('buildReplay - DON!! per-player pool tracking', () => {
  it('starts with zero DON for both players', () => {
    const log = BASE_HEADER
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n';
    const replay = buildReplay(log);
    const p1Don = replay.turns[0].boardAfter.player1.don;
    const p2Don = replay.turns[0].boardAfter.player2.don;
    assert.strictEqual(p1Don.total, 0);
    assert.strictEqual(p2Don.total, 0);
  });

  it('tracks drawn DON per player independently', () => {
    const log = BASE_HEADER
      + '[Alice#1234] Draw 1 Don\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n'
      + '[Bob#5678] Draw 2 Don\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Bob#5678] End Turn\n';
    const replay = buildReplay(log);
    // After Turn 1 (Alice): Alice drew 1, Bob drew 0
    const t1p1 = replay.turns[0].boardAfter.player1.don;
    const t1p2 = replay.turns[0].boardAfter.player2.don;
    assert.strictEqual(t1p1.total, 1, 'Alice drew 1 DON in turn 1');
    assert.strictEqual(t1p2.total, 0, 'Bob drew nothing in turn 1');
    // After Turn 2 (Bob): Alice has 1, Bob drew 2 (total 2)
    const t2p1 = replay.turns[1].boardAfter.player1.don;
    const t2p2 = replay.turns[1].boardAfter.player2.don;
    assert.strictEqual(t2p1.total, 1, 'Alice still has 1 drawn after turn 2');
    assert.strictEqual(t2p2.total, 2, 'Bob drew 2 DON in turn 2');
  });

  it('decrements active DON when DON is attached to a card', () => {
    const log = BASE_HEADER
      + '[Alice#1234] Draw 2 Don\n'
      + '[Alice#1234] Deploy Nami ["OP01-016">OP01-016]\n'
      + '[Alice#1234] Attach 2 Don to Nami ["OP01-016">OP01-016] (2 Total)\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: [OP01-016]\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n';
    const replay = buildReplay(log);
    const don = replay.turns[0].boardAfter.player1.don;
    assert.strictEqual(don.total, 2, 'Alice drew 2 DON');
    assert.strictEqual(don.active, 0, 'All active DON were attached');
    assert.strictEqual(don.totalAttached, 2, '2 DON attached total');
  });

  it('refreshes rested DON at start of next turn when Draw N Don fires', () => {
    // Alice rests 2 DON via card effect, then End Turn; next turn Draw should refresh them
    const log = BASE_HEADER
      + '[Alice#1234] Draw 3 Don\n'
      + '[Alice#1234] Gravity Blade Raging Tiger ["OP06-058">OP06-058]: Rest 2 Don\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n'
      + '[Bob#5678] Draw 2 Don\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Bob#5678] End Turn\n'
      + '[Alice#1234] Draw 2 Don\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n';
    const replay = buildReplay(log);
    // After Turn 1: Alice drew 3, rested 2 -> total=3, active=1, rested=2
    const t1don = replay.turns[0].boardAfter.player1.don;
    assert.strictEqual(t1don.total, 3);
    assert.strictEqual(t1don.active, 1);
    assert.strictEqual(t1don.rested, 2);
    // After Turn 3 (Alice turn 2): refreshed 2 rested, drew 2 more -> total=5, active=5, rested=0
    const t3don = replay.turns[2].boardAfter.player1.don;
    assert.strictEqual(t3don.total, 5);
    assert.strictEqual(t3don.active, 5, 'Rested DON refreshed + 2 new drawn');
    assert.strictEqual(t3don.rested, 0);
  });

  it('DON pool does not bleed between players', () => {
    const log = BASE_HEADER
      + '[Alice#1234] Draw 3 Don\n'
      + '[Alice#1234] Hand: []\n'
      + '[Alice#1234] Board: []\n'
      + '[Alice#1234] Trash: []\n'
      + '[Alice#1234] Life: 5\n'
      + '[Bob#5678] Hand: []\n'
      + '[Bob#5678] Board: []\n'
      + '[Bob#5678] Trash: []\n'
      + '[Bob#5678] Life: 5\n'
      + '[Alice#1234] End Turn\n';
    const replay = buildReplay(log);
    const p1Don = replay.turns[0].boardAfter.player1.don;
    const p2Don = replay.turns[0].boardAfter.player2.don;
    assert.strictEqual(p1Don.total, 3, "Alice's draw must not affect Bob");
    assert.strictEqual(p2Don.total, 0, "Bob's DON must remain 0");
  });
});
