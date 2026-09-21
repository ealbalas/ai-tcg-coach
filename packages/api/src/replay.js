/**
 * Replay builder: walks a raw OPTCGSim log and produces structured TurnState objects
 * for visual replay of the game.
 *
 * Two parsing modes:
 * - Gameplay mode: when the log contains explicit text messages (Deploy, End Turn, etc.),
 *   those are the primary source of board state transitions.
 * - Setup mode: when only RZ1 pipe-delimited lines are present (initial setup phase only),
 *   turns are derived from player-change groups detected by the base parser.
 *
 * NOTE: Text-based gameplay message formats are inferred from OPTCGSim header conventions
 * (e.g. "[Name#disc] Action details") since no confirmed in-game gameplay log samples are
 * available yet. Extend DEPLOY_RE and friends when real samples confirm the actual format.
 */

import { parseLog } from './parser.js';
import { getCardName } from './cards.js';

const STANDARD_LIFE = 5;
const STANDARD_DON = 10;

// --- Gameplay line patterns ---
// All assume OPTCGSim's "[Name#disc] Verb ..." convention observed in header lines.
const DEPLOY_RE = /^\[(.+?)\] [Dd]eploy(?:s|ed)? (.+?) \[".+?">(.+?)\]$/;
const DRAW_NAMED_RE = /^\[(.+?)\] [Dd]raw(?:s|n)? (.+?) \[".+?">(.+?)\]$/;
const DON_ATTACH_RE = /^\[(.+?)\] (?:attaches?|attached) (\d+) DON!!.*? to (.+)$/i;
const ATTACK_RE = /^\[(.+?)\] (?:attacks?|attacking) with (.+?) \[".+?">(.+?)\]/;
const DISCARD_COUNTER_RE = /^\[(.+?)\] [Dd]iscard(?:s|ed)? (.+?) \[".+?">(.+?)\] for counter/;
const END_TURN_RE = /^(?:\[.+?\] )?End Turn$/i;
const LIFE_LOSS_RE = /^\[(.+?)\] (?:takes?|took) (\d+) damage/i;
const TRASH_RE = /^\[(.+?)\] (?:trashes?|trashed?) (.+?) \[".+?">(.+?)\]/i;

function matchGameplayLine(line) {
  let m;
  if (END_TURN_RE.test(line)) return { type: 'endTurn' };
  if ((m = DEPLOY_RE.exec(line))) return { type: 'deploy', playerName: m[1], cardName: m[2], cardId: m[3] };
  if ((m = DRAW_NAMED_RE.exec(line))) return { type: 'draw', playerName: m[1], cardName: m[2], cardId: m[3] };
  if ((m = DON_ATTACH_RE.exec(line))) return { type: 'donAttach', playerName: m[1], count: parseInt(m[2], 10), targetId: m[3].trim() };
  if ((m = ATTACK_RE.exec(line))) return { type: 'attack', playerName: m[1], cardName: m[2], cardId: m[3] };
  if ((m = DISCARD_COUNTER_RE.exec(line))) return { type: 'discard', playerName: m[1], cardName: m[2], cardId: m[3] };
  if ((m = LIFE_LOSS_RE.exec(line))) return { type: 'lifeLoss', playerName: m[1], amount: parseInt(m[2], 10) };
  if ((m = TRASH_RE.exec(line))) return { type: 'trash', playerName: m[1], cardName: m[2], cardId: m[3] };
  return null;
}

function isHeaderOrRZ1(line) {
  if (line.startsWith('RZ1|')) return true;
  if (/^Waiting for a Connection with Room ID:/.test(line)) return true;
  if (/Has Connected$/.test(line)) return true;
  if (/Has Disconnected$/i.test(line)) return true;
  if (/has left the game$/i.test(line)) return true;
  if (/^Version is /.test(line)) return true;
  if (/^\[.+?\] Leader is /.test(line)) return true;
  if (/^\[.+?\] Chose to go (?:First|Second)$/.test(line)) return true;
  return false;
}

function createInitialPlayerState(username, leaderId) {
  return {
    username: username ?? 'Unknown',
    leader: {
      id: leaderId ?? null,
      name: leaderId ? (getCardName(leaderId) ?? null) : null,
      active: true,
      donAttached: 0,
      life: STANDARD_LIFE,
    },
    characters: [],
    hand: [],
    handCount: 0,
    don: { total: STANDARD_DON, active: STANDARD_DON, rested: 0, attachedToLeader: 0 },
    trash: [],
    life: STANDARD_LIFE,
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Parse a raw OPTCGSim log and return a ReplayResponse object.
 * @param {string} logText - raw log file contents
 * @param {number|null} gameId
 */
export function buildReplay(logText, gameId = null) {
  const parsed = parseLog(logText);

  const nameToPlayer = {};
  if (parsed.player1Name) nameToPlayer[parsed.player1Name] = 1;
  if (parsed.player2Name) nameToPlayer[parsed.player2Name] = 2;

  const pState = {
    1: createInitialPlayerState(parsed.player1Name, parsed.player1Leader),
    2: createInitialPlayerState(parsed.player2Name, parsed.player2Leader),
  };

  // Collect gameplay text events (non-header, non-RZ1 lines that match known patterns)
  const lines = logText.split('\n').map((l) => l.trim()).filter(Boolean);
  const gameplayEvents = [];
  for (const line of lines) {
    if (isHeaderOrRZ1(line)) continue;
    const event = matchGameplayLine(line);
    if (event) gameplayEvents.push(event);
  }

  const turns = gameplayEvents.length > 0
    ? buildTurnsFromGameplay(gameplayEvents, pState, nameToPlayer, parsed)
    : buildTurnsFromSetup(parsed, pState);

  return {
    gameId,
    player1Username: parsed.player1Name ?? 'Player 1',
    player2Username: parsed.player2Name ?? 'Player 2',
    player1LeaderId: parsed.player1Leader,
    player2LeaderId: parsed.player2Leader,
    winner: deriveWinner(parsed),
    turns,
  };
}

function deriveWinner(parsed) {
  if (parsed.disconnectedPlayer === 1) return parsed.player2Name ?? 'Player 2';
  if (parsed.disconnectedPlayer === 2) return parsed.player1Name ?? 'Player 1';
  return null;
}

function buildTurnsFromSetup(parsed, pState) {
  return parsed.turns.map((t) => {
    const actions = t.actions.map((a) => {
      const name = getCardName(a.cardId);
      return `Card placed: ${name ? `${name} (${a.cardId})` : a.cardId}`;
    });
    return {
      turn: t.turnNumber,
      activePlayer: t.player,
      actions,
      boardAfter: {
        player1: deepClone(pState[1]),
        player2: deepClone(pState[2]),
      },
    };
  });
}

function buildTurnsFromGameplay(events, pState, nameToPlayer, parsed) {
  const firstActivePlayer = parsed.player1GoesFirst === true ? 1
    : parsed.player1GoesFirst === false ? 2
    : (parsed.turns.length > 0 ? parsed.turns[0].player : 1);

  const turns = [];
  let turnNum = 1;
  let activePlayer = firstActivePlayer;
  let currentActions = [];

  for (const event of events) {
    if (event.type === 'endTurn') {
      turns.push({
        turn: turnNum,
        activePlayer,
        actions: [...currentActions],
        boardAfter: {
          player1: deepClone(pState[1]),
          player2: deepClone(pState[2]),
        },
      });
      turnNum++;
      activePlayer = activePlayer === 1 ? 2 : 1;
      currentActions = [];
      continue;
    }

    const actingPlayer = nameToPlayer[event.playerName] ?? null;
    const desc = applyEvent(event, actingPlayer, pState);
    if (desc) currentActions.push(desc);
  }

  // Flush incomplete trailing turn (game ended without an explicit End Turn)
  if (currentActions.length > 0) {
    turns.push({
      turn: turnNum,
      activePlayer,
      actions: currentActions,
      boardAfter: {
        player1: deepClone(pState[1]),
        player2: deepClone(pState[2]),
      },
    });
  }

  return turns;
}

function applyEvent(event, actingPlayer, pState) {
  if (!actingPlayer || !pState[actingPlayer]) return null;
  const ps = pState[actingPlayer];
  const opp = pState[actingPlayer === 1 ? 2 : 1];

  switch (event.type) {
    case 'deploy': {
      const card = {
        id: event.cardId,
        name: event.cardName || getCardName(event.cardId) || event.cardId,
        active: true,
        donAttached: 0,
      };
      ps.characters.push(card);
      ps.hand = ps.hand.filter((h) => h.id !== event.cardId);
      ps.handCount = Math.max(0, ps.handCount - 1);
      return `Deployed ${card.name}`;
    }
    case 'draw': {
      const card = {
        id: event.cardId,
        name: event.cardName || getCardName(event.cardId) || event.cardId,
      };
      ps.hand.push(card);
      ps.handCount += 1;
      return `Drew ${card.name}`;
    }
    case 'donAttach': {
      const { targetId, count } = event;
      const char = ps.characters.find((c) => c.id === targetId);
      if (char) {
        char.donAttached += count;
        ps.don.active = Math.max(0, ps.don.active - count);
        return `Attached ${count} DON!! to ${char.name ?? targetId}`;
      }
      if (ps.leader.id === targetId || targetId.toLowerCase() === 'leader') {
        ps.leader.donAttached += count;
        ps.don.attachedToLeader += count;
        ps.don.active = Math.max(0, ps.don.active - count);
        return `Attached ${count} DON!! to leader`;
      }
      ps.don.active = Math.max(0, ps.don.active - count);
      return `Attached ${count} DON!! to ${targetId}`;
    }
    case 'attack': {
      const char = ps.characters.find((c) => c.id === event.cardId);
      if (char) char.active = false;
      else if (ps.leader.id === event.cardId) ps.leader.active = false;
      return `Attacked with ${event.cardName ?? event.cardId}`;
    }
    case 'discard': {
      const card = {
        id: event.cardId,
        name: event.cardName || getCardName(event.cardId) || event.cardId,
      };
      ps.trash.push(card);
      ps.hand = ps.hand.filter((h) => h.id !== event.cardId);
      ps.handCount = Math.max(0, ps.handCount - 1);
      return `Discarded ${card.name} for counter`;
    }
    case 'lifeLoss': {
      ps.life = Math.max(0, ps.life - event.amount);
      if (ps.leader) ps.leader.life = ps.life;
      return `${event.playerName} takes ${event.amount} damage`;
    }
    case 'trash': {
      const card = {
        id: event.cardId,
        name: event.cardName || getCardName(event.cardId) || event.cardId,
      };
      ps.trash.push(card);
      ps.characters = ps.characters.filter((c) => c.id !== event.cardId);
      return `Trashed ${card.name}`;
    }
    default:
      return null;
  }
}
