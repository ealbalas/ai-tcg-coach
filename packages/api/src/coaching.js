/**
 * Heuristic coaching engine (layer='rule').
 *
 * Operates on the parsed log structure and produces coaching notes.
 * Each heuristic is a function that receives the full parsed log and
 * returns an array of note objects: { turnId, turnNumber, severity, text }.
 *
 * LIMITATION NOTE
 * ---------------
 * The sample log only covers the initial card-placement / deck-setup phase
 * (cards being placed into starting zones before the game proper begins).
 * In-game state fields such as DON!! counts, life totals, and attack events
 * are not yet confirmed from real in-game action lines.
 *
 * Heuristics that require confirmed field meanings (DON!! usage, attack detection)
 * are implemented with best-effort interpretation of the raw fields and are clearly
 * marked with their assumptions.  Heuristics that would generate false positives
 * on ambiguous data are skipped and documented below.
 */

import { getCardName } from './cards.js';

/**
 * @param {import('./parser.js').ParsedLog} parsedLog
 * @param {Map<number, string>} turnIdMap  - maps turn_number -> DB UUID for that turn
 * @param {number} myPlayer  - which player number (1 or 2) this user is
 * @returns {Array<{turnNumber: number|null, severity: string, text: string}>}
 */
export function runHeuristics(parsedLog, turnIdMap, myPlayer) {
  const notes = [];

  for (const turn of parsedLog.turns) {
    // Only coach the player who uploaded the log (from their perspective)
    if (turn.player !== myPlayer) continue;

    const turnNotes = [
      ...checkDonUnused(turn, parsedLog),
      ...checkNoAttacks(turn, parsedLog),
      ...checkFirstTurnSetup(turn, parsedLog),
      ...checkEmptyTurn(turn, parsedLog),
    ];

    for (const note of turnNotes) {
      notes.push({
        turnNumber: turn.turnNumber,
        severity: note.severity,
        text: note.text,
      });
    }
  }

  // Game-level notes (turnNumber: null signals turn_id should be null)
  const gameNotes = checkLeaderRecognition(parsedLog, myPlayer);
  for (const note of gameNotes) {
    notes.push({ turnNumber: null, severity: note.severity, text: note.text });
  }

  return notes;
}

/**
 * Heuristic 1: DON!! left unused.
 * IMPLEMENTATION STATUS: SKIPPED - field meanings not confirmed from log samples.
 */
function checkDonUnused(_turn, _parsedLog) {
  return [];
}

/**
 * Heuristic 2: No attacks made.
 * IMPLEMENTATION STATUS: SKIPPED - attack action codes not confirmed from log samples.
 */
function checkNoAttacks(_turn, _parsedLog) {
  return [];
}

/**
 * Heuristic 3: Opening hand / life zone setup (turn 1).
 *
 * In OPTCG, each player places exactly 5 cards from their hand into their life zone
 * at the start of the game.  The log's setup phase should therefore record exactly
 * 5 card-placement actions for the first turn.
 */
function checkFirstTurnSetup(turn, _parsedLog) {
  if (turn.turnNumber !== 1) return [];

  const actionCount = turn.actions.length;

  if (actionCount <= 3) {
    return [{
      severity: 'warning',
      text: `Your turn 1 only recorded ${actionCount} setup action${actionCount !== 1 ? 's' : ''}. ` +
        'Did you complete your opening life card placement? ' +
        'OPTCG requires each player to place 5 cards into the life zone before the game begins.',
    }];
  }

  if (actionCount === 4) {
    return [{
      severity: 'info',
      text: `Turn 1 shows ${actionCount} setup actions (expected 5 for life zone placement). ` +
        'You may have missed placing one life card.',
    }];
  }

  if (actionCount >= 6) {
    return [{
      severity: 'info',
      text: `Turn 1 shows ${actionCount} setup actions, more than the usual 5. ` +
        'The log may include extra events, or setup was restarted.',
    }];
  }

  return [];
}

/**
 * Heuristic 4: Empty turn (non-turn-1).
 *
 * A player turn with no recorded actions after the setup phase is unusual.
 * This may mean the player passed without doing anything, which is rarely optimal.
 */
function checkEmptyTurn(turn, _parsedLog) {
  if (turn.turnNumber === 1) return [];
  if (turn.actions.length > 0) return [];

  return [{
    severity: 'info',
    text: `Turn ${turn.turnNumber}: No actions recorded for your turn. ` +
      'If this is correct, consider whether you had plays available - ' +
      'in OPTCG, applying pressure every turn is usually correct.',
  }];
}

/**
 * Heuristic 5: Leader card recognition (game-level).
 *
 * If the leader is recognized in the card database, add a one-time strategic tip
 * based on which set the leader comes from.
 */
function checkLeaderRecognition(parsedLog, myPlayer) {
  const myLeaderId = myPlayer === 1 ? parsedLog.player1Leader : parsedLog.player2Leader;
  if (!myLeaderId) return [];

  const name = getCardName(myLeaderId);
  if (!name) return [];

  const setCode = myLeaderId.split('-')[0];
  const setNumber = parseInt(setCode.replace(/[^0-9]/g, ''), 10);

  let tip;
  if (!isNaN(setNumber) && setNumber >= 1 && setNumber <= 5) {
    tip = 'Classic set leader - foundational strategies apply. ' +
      'Study the core mechanics and basic deck archetypes for this leader.';
  } else {
    tip = 'Newer set leader - keep up with the evolving meta. ' +
      'Check recent tournament results for current optimal lines.';
  }

  return [{
    severity: 'info',
    text: `Leader recognized: ${name} (${myLeaderId}). ${tip}`,
  }];
}
