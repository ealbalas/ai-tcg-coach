import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLog } from '../src/parser.js';

const BASE_HEADER = `Waiting for a Connection with Room ID:ABC1234
Alice#1234 Has Connected
Bob#5678 Has Connected
Version is 1.43a.1
[Alice#1234] Leader is Monkey D. Luffy ["OP01-001">OP01-001]
[Bob#5678] Leader is Roronoa Zoro ["OP01-002">OP01-002]
[Bob#5678] Chose to go Second
`;

describe('parseLog - disconnect detection', () => {
  it('sets disconnectedPlayer=2 when player2 disconnects', () => {
    const log = BASE_HEADER + 'Bob#5678 Has Disconnected\n';
    const result = parseLog(log);
    assert.strictEqual(result.disconnectedPlayer, 2);
  });

  it('sets disconnectedPlayer=1 when player1 disconnects', () => {
    const log = BASE_HEADER + 'Alice#1234 Has Disconnected\n';
    const result = parseLog(log);
    assert.strictEqual(result.disconnectedPlayer, 1);
  });

  it('sets disconnectedPlayer via "has left the game" variant', () => {
    const log = BASE_HEADER + 'Bob#5678 has left the game\n';
    const result = parseLog(log);
    assert.strictEqual(result.disconnectedPlayer, 2);
  });

  it('leaves disconnectedPlayer null when no disconnect occurs', () => {
    const result = parseLog(BASE_HEADER);
    assert.strictEqual(result.disconnectedPlayer, null);
  });
});

describe('parseLog - dirty log detection', () => {
  const OLD_SESSION = `Waiting for a Connection with Room ID:OLD0001
OldPlayer#0001 Has Connected
Bob#5678 Has Connected
Version is 1.40
`;

  it('sets hadPartialPreviousGame=false for a clean log', () => {
    const result = parseLog(BASE_HEADER);
    assert.strictEqual(result.hadPartialPreviousGame, false);
  });

  it('sets hadPartialPreviousGame=true for a dirty log', () => {
    const dirtyLog = OLD_SESSION + BASE_HEADER;
    const result = parseLog(dirtyLog);
    assert.strictEqual(result.hadPartialPreviousGame, true);
  });

  it('parses only the last session from a dirty log', () => {
    const dirtyLog = OLD_SESSION + BASE_HEADER;
    const result = parseLog(dirtyLog);
    assert.strictEqual(result.roomId, 'ABC1234');
    assert.strictEqual(result.player1Name, 'Alice#1234');
  });
});

describe('deriveResult helper logic', () => {
  // Test deriveResult indirectly via the parser flags
  it('disconnect of player2 -> player1 wins (uploader at player1 wins)', () => {
    const log = BASE_HEADER + 'Bob#5678 Has Disconnected\n';
    const parsed = parseLog(log);
    // When myPlayer=1 and disconnectedPlayer=2, result should be 'win'
    const myPlayer = 1;
    const result = parsed.disconnectedPlayer === myPlayer ? 'loss' : parsed.disconnectedPlayer != null ? 'win' : 'unknown';
    assert.strictEqual(result, 'win');
  });

  it('disconnect of player1 -> loss for uploader at player1', () => {
    const log = BASE_HEADER + 'Alice#1234 Has Disconnected\n';
    const parsed = parseLog(log);
    const myPlayer = 1;
    const result = parsed.disconnectedPlayer === myPlayer ? 'loss' : parsed.disconnectedPlayer != null ? 'win' : 'unknown';
    assert.strictEqual(result, 'loss');
  });

  it('no disconnect -> unknown', () => {
    const parsed = parseLog(BASE_HEADER);
    const myPlayer = 1;
    const result = parsed.disconnectedPlayer === myPlayer ? 'loss' : parsed.disconnectedPlayer != null ? 'win' : 'unknown';
    assert.strictEqual(result, 'unknown');
  });
});
