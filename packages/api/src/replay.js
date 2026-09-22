/**
 * Replay builder: walks a raw OPTCGSim log and produces structured TurnState objects
 * for visual replay of the game.
 *
 * Two parsing modes:
 * - Gameplay mode: when the log contains [Player] End Turn lines, those plus authoritative
 *   end-of-turn state snapshots ([Player] Hand/Board/Trash/Life) are used as the primary
 *   source of board state.
 * - Setup mode: when only RZ1 pipe-delimited lines are present (initial setup phase only),
 *   turns are derived from player-change groups detected by the base parser.
 */

import { parseLog } from './parser.js';
import { getCardName, getCardDetails } from './cards.js';

const STANDARD_LIFE = 5;

// Confirmed OPTCGSim gameplay line patterns (from real match logs)
const DEPLOY_RE = /^\[(.+?)\] Deploy (.+?) \["(.+?)">(.+?)\]$/;
const ATTACK_RE = /^\[(.+?)\] (.+?) \["(.+?)">(.+?)\] attacking (.+?) \["(.+?)">(.+?)\]/;
const DISCARD_COUNTER_RE = /^\[(.+?)\] Discard (.+?) \["(.+?)">(.+?)\] for Counter \d+$/;
const DON_ATTACH_RE = /^\[(.+?)\] Attach (\d+) Don to (.+?) \["(.+?)">(.+?)\] \((\d+) Total\)$/;
const END_TURN_RE = /^\[(.+?)\] End Turn$/;
const DESTROYED_RE = /^\[(.+?)\] (.+?) \["(.+?)">(.+?)\] Destroyed$/;
// DON!! pool events
const DON_DRAW_RE = /^\[(.+?)\] Draw (\d+) Don$/;
const DON_ACTIVATE_RE = /^\[(.+?)\] .+: Activate (\d+) Don$/;
const DON_REST_EFFECT_RE = /^\[(.+?)\] .+: Rest (\d+) Don$/;

// Authoritative end-of-turn state snapshots (appear before or after End Turn)
const HAND_SNAP_RE = /^\[(.+?)\] Hand: \[([^\]]*)\]$/;
const BOARD_SNAP_RE = /^\[(.+?)\] Board: \[([^\]]*)\]$/;
const TRASH_SNAP_RE = /^\[(.+?)\] Trash: \[([^\]]*)\]$/;
const LIFE_SNAP_RE = /^\[(.+?)\] Life: (\d+)$/;

function createInitialPlayerState(username, leaderId) {
  const leaderDetails = leaderId ? getCardDetails(leaderId) : null;
  return {
    username: username ?? 'Unknown',
    leader: {
      id: leaderId ?? null,
      name: leaderId ? (getCardName(leaderId) ?? null) : null,
      active: true,
      donAttached: 0,
      life: STANDARD_LIFE,
      power: leaderDetails?.power ?? null,
      effect: leaderDetails?.effect ?? null,
      type: leaderDetails?.type ?? null,
      cost: leaderDetails?.cost ?? null,
    },
    characters: [],
    stage: [],
    hand: [],
    handCount: 0,
    don: { total: 0, active: 0, rested: 0, attachedToLeader: 0, totalAttached: 0 },
    trash: [],
    life: STANDARD_LIFE,
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function parseIdList(raw) {
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/**
 * Parse a raw OPTCGSim log and return a ReplayResponse object.
 * @param {string} logText - raw log file contents
 * @param {number|string|null} gameId
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

  const lines = logText.split('\n').map((l) => l.trim()).filter(Boolean);
  const hasGameplay = lines.some((l) => END_TURN_RE.test(l));

  const turns = hasGameplay
    ? buildTurnsFromGameplay(lines, pState, nameToPlayer, parsed)
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

function emptySnap() {
  return { hand: null, board: null, trash: null, life: null };
}

function snapComplete(snapBuf) {
  return [1, 2].every((p) => {
    const s = snapBuf[p];
    return s.hand !== null && s.board !== null && s.trash !== null && s.life !== null;
  });
}

function buildTurnsFromGameplay(lines, pState, nameToPlayer, parsed) {
  const firstActivePlayer = parsed.player1GoesFirst === true ? 1
    : parsed.player1GoesFirst === false ? 2
    : (parsed.turns.length > 0 ? parsed.turns[0].player : 1);

  const turns = [];
  let turnNum = 1;
  let activePlayer = firstActivePlayer;
  let currentActions = [];
  // Set when End Turn arrives before snapshots are complete
  let pendingEndTurn = null;

  // DON!! totals per (player, card ID); persists across turns, cleared on Destroyed
  let donByCardId = { 1: {}, 2: {} };
  // Cards that attacked this turn per player; reset per turn
  let restedCards = { 1: new Set(), 2: new Set() };
  // Per-player DON pool: drawn from deck (total), and current active/rested in the pool
  let donPoolByPlayer = {
    1: { drawn: 0, active: 0, rested: 0 },
    2: { drawn: 0, active: 0, rested: 0 },
  };

  const snapBuf = { 1: emptySnap(), 2: emptySnap() };

  function snapshotToPlayerState(playerNum) {
    const snap = snapBuf[playerNum];
    const orig = pState[playerNum];
    const life = snap.life ?? orig.life;
    const allBoardCards = (snap.board ?? []).map((id) => {
      const details = getCardDetails(id);
      return {
        id,
        name: getCardName(id) ?? id,
        active: !restedCards[playerNum].has(id),
        donAttached: donByCardId[playerNum][id] ?? 0,
        power: details?.power ?? null,
        effect: details?.effect ?? null,
        type: details?.type ?? null,
        cost: details?.cost ?? null,
      };
    });
    const stage = allBoardCards.filter((c) => c.type?.toLowerCase() === 'stage');
    const characters = allBoardCards.filter((c) => c.type?.toLowerCase() !== 'stage');
    const hand = (snap.hand ?? []).map((id) => {
      const details = getCardDetails(id);
      return {
        id,
        name: getCardName(id) ?? id,
        power: details?.power ?? null,
        effect: details?.effect ?? null,
        type: details?.type ?? null,
        cost: details?.cost ?? null,
      };
    });
    const trash = (snap.trash ?? []).map((id) => ({ id, name: getCardName(id) ?? id }));
    const attachedToLeader = donByCardId[playerNum][orig.leader.id] ?? 0;
    const attachedToChars = characters.reduce((sum, c) => sum + c.donAttached, 0);
    const leaderDetails = getCardDetails(orig.leader.id);
    const pool = donPoolByPlayer[playerNum];
    return {
      ...orig,
      characters,
      stage,
      hand,
      handCount: hand.length,
      trash,
      life,
      leader: {
        ...orig.leader,
        life,
        donAttached: attachedToLeader,
        power: leaderDetails?.power ?? null,
        effect: leaderDetails?.effect ?? null,
        type: leaderDetails?.type ?? null,
        cost: leaderDetails?.cost ?? null,
      },
      don: {
        total: pool.drawn,
        active: pool.active,
        rested: pool.rested,
        attachedToLeader,
        totalAttached: attachedToLeader + attachedToChars,
      },
    };
  }

  function finalizeTurn(num, player) {
    turns.push({
      turn: num,
      activePlayer: player,
      actions: [...currentActions],
      boardAfter: {
        player1: snapshotToPlayerState(1),
        player2: snapshotToPlayerState(2),
      },
    });
    currentActions = [];
    restedCards = { 1: new Set(), 2: new Set() };
    snapBuf[1] = emptySnap();
    snapBuf[2] = emptySnap();
  }

  for (const line of lines) {
    let m;

    if ((m = HAND_SNAP_RE.exec(line))) {
      const p = nameToPlayer[m[1]];
      if (p) snapBuf[p].hand = parseIdList(m[2]);
    } else if ((m = BOARD_SNAP_RE.exec(line))) {
      const p = nameToPlayer[m[1]];
      if (p) snapBuf[p].board = parseIdList(m[2]);
    } else if ((m = TRASH_SNAP_RE.exec(line))) {
      const p = nameToPlayer[m[1]];
      if (p) snapBuf[p].trash = parseIdList(m[2]);
    } else if ((m = LIFE_SNAP_RE.exec(line))) {
      const p = nameToPlayer[m[1]];
      if (p) snapBuf[p].life = parseInt(m[2], 10);
    } else if (END_TURN_RE.test(line)) {
      if (snapComplete(snapBuf)) {
        finalizeTurn(turnNum, activePlayer);
      } else {
        pendingEndTurn = {
          turnNum,
          activePlayer,
          actions: [...currentActions],
          restedCards: { 1: new Set(restedCards[1]), 2: new Set(restedCards[2]) },
          donByCardId: { 1: { ...donByCardId[1] }, 2: { ...donByCardId[2] } },
          donPoolByPlayer: {
            1: { ...donPoolByPlayer[1] },
            2: { ...donPoolByPlayer[2] },
          },
        };
        currentActions = [];
        restedCards = { 1: new Set(), 2: new Set() };
      }
      turnNum++;
      activePlayer = activePlayer === 1 ? 2 : 1;
      continue;
    } else if ((m = DEPLOY_RE.exec(line))) {
      currentActions.push(`Deployed ${m[2]}`);
    } else if ((m = ATTACK_RE.exec(line))) {
      const ap = nameToPlayer[m[1]];
      if (ap) restedCards[ap].add(m[4]);
      currentActions.push(`${m[2]} attacking ${m[5]}`);
    } else if ((m = DON_ATTACH_RE.exec(line))) {
      const dp = nameToPlayer[m[1]];
      if (dp) {
        donByCardId[dp][m[5]] = parseInt(m[6], 10);
        donPoolByPlayer[dp].active = Math.max(0, donPoolByPlayer[dp].active - parseInt(m[2], 10));
      }
      currentActions.push(`Attach ${m[2]} DON!! to ${m[3]} (${m[6]} Total)`);
    } else if ((m = DISCARD_COUNTER_RE.exec(line))) {
      currentActions.push(`Discarded ${m[2]} for counter`);
    } else if ((m = DESTROYED_RE.exec(line))) {
      const xp = nameToPlayer[m[1]];
      if (xp) {
        donPoolByPlayer[xp].rested += donByCardId[xp][m[4]] ?? 0;
        delete donByCardId[xp][m[4]];
      }
      currentActions.push(`${m[2]} Destroyed`);
    } else if ((m = DON_DRAW_RE.exec(line))) {
      const dp = nameToPlayer[m[1]];
      if (dp) {
        // Refresh: rested DON becomes active at turn start before drawing
        donPoolByPlayer[dp].active += donPoolByPlayer[dp].rested;
        donPoolByPlayer[dp].rested = 0;
        const n = parseInt(m[2], 10);
        donPoolByPlayer[dp].drawn += n;
        donPoolByPlayer[dp].active += n;
      }
    } else if ((m = DON_ACTIVATE_RE.exec(line))) {
      const dp = nameToPlayer[m[1]];
      if (dp) {
        const n = parseInt(m[2], 10);
        const moved = Math.min(n, donPoolByPlayer[dp].rested);
        donPoolByPlayer[dp].rested -= moved;
        donPoolByPlayer[dp].active += moved;
      }
    } else if ((m = DON_REST_EFFECT_RE.exec(line))) {
      const dp = nameToPlayer[m[1]];
      if (dp) {
        const n = parseInt(m[2], 10);
        const moved = Math.min(n, donPoolByPlayer[dp].active);
        donPoolByPlayer[dp].active -= moved;
        donPoolByPlayer[dp].rested += moved;
      }
    }

    if (pendingEndTurn !== null && snapComplete(snapBuf)) {
      const nextActions = currentActions;
      const nextRested = restedCards;
      const nextDon = donByCardId;
      const nextDonPool = donPoolByPlayer;
      ({ actions: currentActions, restedCards, donByCardId, donPoolByPlayer } = pendingEndTurn);
      finalizeTurn(pendingEndTurn.turnNum, pendingEndTurn.activePlayer);
      currentActions = nextActions;
      restedCards = nextRested;
      donByCardId = nextDon;
      donPoolByPlayer = nextDonPool;
      pendingEndTurn = null;
    }
  }

  // Flush a trailing incomplete turn (game ended without a final End Turn + snapshot)
  if (currentActions.length > 0 || pendingEndTurn !== null) {
    const num = pendingEndTurn ? pendingEndTurn.turnNum : turnNum;
    const player = pendingEndTurn ? pendingEndTurn.activePlayer : activePlayer;
    turns.push({
      turn: num,
      activePlayer: player,
      actions: pendingEndTurn ? pendingEndTurn.actions : currentActions,
      boardAfter: {
        player1: deepClone(pState[1]),
        player2: deepClone(pState[2]),
      },
    });
  }

  return turns;
}
