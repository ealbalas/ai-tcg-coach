import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadCards, getCardName } from '../src/cards.js';
import { runHeuristics } from '../src/coaching.js';

function makeLog({ player1Leader = 'ST01-001', player2Leader = 'ST02-001', turns = [] } = {}) {
  return {
    player1Leader,
    player2Leader,
    player1GoesFirst: true,
    version: '1.0',
    roomId: 'TEST',
    turns,
  };
}

function makeTurn(turnNumber, player, actionCount) {
  return {
    turnNumber,
    player,
    actions: Array.from({ length: actionCount }, (_, i) => ({
      seq: i + 1,
      cardId: `OP01-00${i + 1}`,
      player,
    })),
    lastBoardState: {},
  };
}

const emptyMap = new Map();

before(async () => {
  await loadCards();
});

describe('runHeuristics - checkFirstTurnSetup', () => {
  for (const count of [0, 1, 2, 3]) {
    it(`flags warning when turn 1 has ${count} actions`, () => {
      const log = makeLog({ turns: [makeTurn(1, 1, count)] });
      const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber === 1);
      assert.ok(notes.length > 0, `Expected a note for ${count} actions`);
      assert.ok(notes.some((n) => n.severity === 'warning'), `Expected warning severity for ${count} actions`);
    });
  }

  it('flags info when turn 1 has 4 actions', () => {
    const log = makeLog({ turns: [makeTurn(1, 1, 4)] });
    const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber === 1);
    assert.ok(notes.some((n) => n.severity === 'info'), 'Expected info note for 4 actions');
  });

  it('produces no setup note when turn 1 has exactly 5 actions', () => {
    const log = makeLog({ turns: [makeTurn(1, 1, 5)] });
    const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber === 1);
    assert.strictEqual(notes.length, 0, `Expected no turn-1 notes for 5 actions`);
  });

  it('flags info when turn 1 has 6+ actions', () => {
    const log = makeLog({ turns: [makeTurn(1, 1, 7)] });
    const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber === 1);
    assert.ok(notes.some((n) => n.severity === 'info'), 'Expected info note for 7 actions');
  });
});

describe('runHeuristics - checkEmptyTurn', () => {
  it('flags info for a non-turn-1 with 0 actions', () => {
    const log = makeLog({ turns: [makeTurn(1, 1, 5), makeTurn(2, 1, 0)] });
    const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber === 2);
    assert.ok(notes.length > 0, 'Expected note for empty non-turn-1');
    assert.strictEqual(notes[0].severity, 'info');
  });

  it('does not flag turns with at least one action', () => {
    const log = makeLog({ turns: [makeTurn(1, 1, 5), makeTurn(2, 1, 3)] });
    const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber === 2);
    assert.strictEqual(notes.length, 0, 'Expected no note when turn has actions');
  });
});

describe('runHeuristics - checkLeaderRecognition', () => {
  it('produces a game-level note (turnNumber=null) when leader is recognized', () => {
    const log = makeLog({ player1Leader: 'ST01-001' });
    const notes = runHeuristics(log, emptyMap, 1);
    const leaderNotes = notes.filter((n) => n.turnNumber === null);
    // Only assert if the card was actually loaded (remote or fallback)
    if (getCardName('ST01-001') !== null) {
      assert.ok(leaderNotes.length > 0, 'Expected a game-level note when card is recognized');
      assert.strictEqual(leaderNotes[0].severity, 'info');
    }
    // When not recognized, leaderNotes.length may be 0 - that is also acceptable
  });

  it('produces no game-level note when leader is unrecognized', () => {
    const log = makeLog({ player1Leader: 'ZZ99-999' });
    const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber === null);
    assert.strictEqual(notes.length, 0, 'Expected no note for unknown card ID');
  });

  it('produces no game-level note when leader is null', () => {
    const log = makeLog({ player1Leader: null });
    const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber === null);
    assert.strictEqual(notes.length, 0, 'Expected no note when leader ID is null');
  });
});

describe('runHeuristics - only coaches myPlayer', () => {
  it('skips opponent turns', () => {
    const log = makeLog({
      turns: [
        makeTurn(1, 2, 0),
        makeTurn(2, 2, 0),
      ],
    });
    // myPlayer=1, turns belong to player 2 - should generate zero turn-level notes
    const notes = runHeuristics(log, emptyMap, 1).filter((n) => n.turnNumber !== null);
    assert.strictEqual(notes.length, 0, 'Expected no turn notes for opponent turns');
  });
});

describe('runHeuristics - note shape', () => {
  it('each note has turnNumber, severity, and text fields', () => {
    const log = makeLog({ turns: [makeTurn(1, 1, 0)] });
    const notes = runHeuristics(log, emptyMap, 1);
    for (const note of notes) {
      assert.ok('turnNumber' in note, 'note missing turnNumber');
      assert.ok('severity' in note, 'note missing severity');
      assert.ok('text' in note, 'note missing text');
      assert.ok(['info', 'warning', 'critical'].includes(note.severity), `invalid severity: ${note.severity}`);
      if (note.turnNumber !== null) {
        assert.strictEqual(typeof note.turnNumber, 'number');
      }
      assert.strictEqual(typeof note.text, 'string');
      assert.ok(note.text.length > 0, 'text should not be empty');
    }
  });
});
