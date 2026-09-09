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

/**
 * @param {import('./parser.js').ParsedLog} parsedLog
 * @param {Map<number, string>} turnIdMap  - maps turn_number -> DB UUID for that turn
 * @param {number} myPlayer  - which player number (1 or 2) this user is
 * @returns {Array<{turnNumber: number, severity: string, text: string}>}
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
    ];

    for (const note of turnNotes) {
      notes.push({
        turnNumber: turn.turnNumber,
        severity: note.severity,
        text: note.text,
      });
    }
  }

  return notes;
}

/**
 * Heuristic 1: DON!! left unused.
 *
 * DON!! is the resource system in OPTCG.  Players have a DON!! deck and attach
 * DON!! cards to characters/leader to give power boosts, or use them for costs.
 * Leaving DON!! unspent at end of turn is generally suboptimal.
 *
 * IMPLEMENTATION STATUS: SKIPPED for v1 heuristic accuracy.
 * The available log sample does not include confirmed in-game action sequences
 * (only deck-setup phase is shown).  Without knowing which action types correspond
 * to "DON!! attach" vs "DON!! for cost" vs "end turn", we cannot reliably compute
 * remaining DON!! without generating false positives.
 *
 * When the log format for in-game actions is confirmed, implement by:
 * - Identifying "gain DON!!" action types (player receives DON!! at turn start)
 * - Identifying "attach DON!!" and "use DON!! for cost" action types
 * - Computing: gained - spent.  Flag if remainder > 0.
 */
function checkDonUnused(_turn, _parsedLog) {
  // Skipped: field meanings for in-game DON!! actions not yet confirmed from log samples.
  // Re-enable once richer in-game log samples are analyzed.
  return [];
}

/**
 * Heuristic 2: No attacks made.
 *
 * In OPTCG, applying pressure every turn is generally correct.  A turn with no
 * attacks (when the player has characters or their leader available to attack)
 * is worth flagging as informational.
 *
 * IMPLEMENTATION STATUS: SKIPPED for v1 heuristic accuracy.
 * Attack actions cannot be distinguished from other actions without confirmed
 * action-type field values.  The log sample only shows setup-phase card placements.
 *
 * When confirmed: look for action lines with the attack action code, compare
 * count against available characters on board.  Flag if zero attacks and
 * board state shows attackers are present.
 */
function checkNoAttacks(_turn, _parsedLog) {
  // Skipped: action type field (distinguishing attack vs. play/draw/etc.) not confirmed.
  // Re-enable once in-game action lines are reverse-engineered from richer samples.
  return [];
}

/**
 * Heuristic 3: First turn draw setup.
 *
 * The player who goes first in OPTCG does not draw on their first turn (rule).
 * If the log shows them drawing anyway, that is a rules error worth flagging.
 * Additionally, an unusually low action count on turn 1 may indicate the player
 * skipped setting up (e.g., forgot to look at their opening hand mulligan option).
 *
 * IMPLEMENTATION STATUS: PARTIAL.
 * We can detect whether the game's very first turn (turn 1) appears to be a
 * setup phase with very few actions.  We flag it only if the action count is
 * suspiciously low (< 2) because that strongly suggests an incomplete setup.
 * False-positive rate is low: a player who makes zero or one actions on turn 1
 * almost certainly forgot something.
 */
function checkFirstTurnSetup(turn, parsedLog) {
  if (turn.turnNumber !== 1) return [];

  // Only relevant when the user goes first (first turn belongs to the player who goes first)
  // parsedLog.player1GoesFirst may be null if not recorded in log
  const actionCount = turn.actions.length;

  // During the setup phase, players place 5 cards from hand into their life zone.
  // The sample shows 10 setup actions (5 per player sequentially).
  // If the FIRST turn has fewer than 2 actions, it is suspiciously incomplete.
  // We cannot reliably distinguish "setup phase" from "main turn" without confirmed
  // action-type fields, so we use a conservative threshold.
  if (actionCount < 2) {
    return [{
      severity: 'info',
      text: `Turn 1: Only ${actionCount} action(s) recorded on your first turn. ` +
        'Make sure you completed your opening setup (e.g., placing life cards) correctly.',
    }];
  }

  return [];
}
