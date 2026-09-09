/**
 * OPTCGSim log file parser.
 *
 * FILE FORMAT OVERVIEW
 * ====================
 * The log file has two sections: a plain-text header followed by pipe-delimited event lines.
 *
 * HEADER SECTION (plain text, one fact per line)
 * -----------------------------------------------
 * "Waiting for a Connection with Room ID:<ROOM_ID>"
 *   - Room ID is a 7-character alphanumeric string (e.g. W8Q7JKN)
 *
 * "<username>#<discriminator> Has Connected"
 *   - Player join events; the first connector becomes player 1, second player 2
 *
 * "Version is <version>"
 *   - OPTCGSim client version (e.g. "1.43a.1")
 *
 * '[<username>#<discriminator>] Leader is <card_name> ["<card_id>"><card_id>]'
 *   - Declares each player's leader card.  The card ID appears twice: once in quotes
 *     and once after the ">".  Only the second occurrence is needed.
 *
 * "[<username>#<discriminator>] Chose to go Second"
 *   - Which player elected to go second (the other player goes first).
 *
 * EVENT LINES (pipe-delimited, prefix "RZ1")
 * -------------------------------------------
 * Two line types share the same zone prefix "RZ1":
 *
 * ACTION line:
 *   RZ1|<seq>|<player>|<card_id>|<f4>|<f5>|<f6>|<f7>|<f8>|<f9>|<f10>|<f11>|<f12>
 *   Fields:
 *     seq      - monotonically increasing action sequence number (integer)
 *     player   - 1 or 2 (which player performed the action)
 *     card_id  - OPTCG card identifier (e.g. "OP17-094"); set code + dash + card number
 *     f4       - appears to always be 0 in the sample; purpose unknown
 *     f5       - card position / zone index within its zone (0-based)
 *     f6       - appears to always be 0; purpose unknown
 *     f7       - count of cards processed so far in the current sub-phase (0-based)
 *                increments each time another card is placed/drawn in the same phase
 *     f8..f12  - always 0 in sample; reserved / purpose unknown
 *
 * STATE SNAPSHOT (CHK) line:
 *   RZ1|CHK|<seq>|<player>|<f0>|<f1>|<f2>|<f3>|<f4>|<f5>|<f6>|<f7>|<f8>|<f9>
 *   Emitted after each ACTION to record the resulting game state.
 *   Fields:
 *     seq      - matches the preceding ACTION line
 *     player   - same player as the preceding action
 *     f0       - appears to be 50 in every sample line; possibly deck size at game start
 *                or a fixed constant (50-card decks are standard in OPTCG)
 *     f1       - always 0 in sample; purpose unknown
 *     f2       - always 0 in sample; purpose unknown
 *     f3       - always 0 in sample; purpose unknown
 *     f4       - appears to be 10 in every sample; possibly starting life total
 *                (OPTCG standard is 5 life, but some formats vary - treating as opaque)
 *     f5       - always 0 in sample; purpose unknown
 *     f6       - always 0 in sample; purpose unknown
 *     f7       - always 0 in sample; purpose unknown
 *     f8       - increments 0→1 after all 10 cards are placed; likely signals
 *                phase completion (e.g. deck/hand setup done → 1)
 *     f9       - always 0 in sample; purpose unknown
 *
 * TURN GROUPING HEURISTIC
 * -----------------------
 * The log does not contain explicit "start of turn" markers.  We reconstruct turns by
 * grouping consecutive ACTION lines by player changes: each time the acting player
 * switches from the previous action's player, we start a new turn.  The very first
 * sequence of actions belongs to turn 1 for the player who went first.
 *
 * NOTE: Because the sample only shows the initial card-placement / setup phase,
 * we do not yet have confirmed field meanings for in-game state (life totals, DON!!
 * counts, attack actions).  Unknown fields are stored raw so they can be re-interpreted
 * once richer samples are available.
 */

/**
 * @typedef {Object} ParsedLog
 * @property {string} roomId
 * @property {string} version
 * @property {string} player1Name
 * @property {string} player2Name
 * @property {string|null} player1Leader
 * @property {string|null} player2Leader
 * @property {boolean|null} player1GoesFirst  - true if player1 goes first, null if unknown
 * @property {Turn[]} turns
 * @property {RawEvent[]} rawEvents
 */

/**
 * @typedef {Object} Turn
 * @property {number} turnNumber
 * @property {number} player
 * @property {Action[]} actions
 * @property {object|null} lastBoardState  - CHK snapshot after the final action of the turn
 */

/**
 * @typedef {Object} Action
 * @property {number} seq
 * @property {number} player
 * @property {string} cardId
 * @property {number[]} rawFields  - all numeric fields after card_id, stored verbatim
 * @property {object|null} boardStateAfter  - the CHK line immediately following this action
 */

/**
 * @typedef {Object} RawEvent
 * @property {'action'|'chk'|'header'|'unknown'} type
 * @property {string} raw
 * @property {object} parsed
 */

export function parseLog(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const result = {
    roomId: null,
    version: null,
    player1Name: null,
    player2Name: null,
    player1Leader: null,
    player2Leader: null,
    player1GoesFirst: null,
    turns: [],
    rawEvents: [],
  };

  // Maps username#discriminator -> player number (1 or 2)
  const playerMap = {};
  let connectionOrder = 0;

  const eventLines = [];

  for (const line of lines) {
    // Room ID header
    const roomMatch = line.match(/^Waiting for a Connection with Room ID:(\S+)/);
    if (roomMatch) {
      result.roomId = roomMatch[1];
      result.rawEvents.push({ type: 'header', raw: line, parsed: { roomId: result.roomId } });
      continue;
    }

    // Player connect
    const connectMatch = line.match(/^(.+#\d+) Has Connected$/);
    if (connectMatch) {
      connectionOrder++;
      const name = connectMatch[1];
      playerMap[name] = connectionOrder;
      if (connectionOrder === 1) result.player1Name = name;
      if (connectionOrder === 2) result.player2Name = name;
      result.rawEvents.push({ type: 'header', raw: line, parsed: { player: connectionOrder, name } });
      continue;
    }

    // Version
    const versionMatch = line.match(/^Version is (.+)$/);
    if (versionMatch) {
      if (!result.version) result.version = versionMatch[1];
      result.rawEvents.push({ type: 'header', raw: line, parsed: { version: versionMatch[1] } });
      continue;
    }

    // Leader declaration: [Name#1234] Leader is Card Name ["OP17-079">OP17-079]
    const leaderMatch = line.match(/^\[(.+?)\] Leader is .+? \[".+?">(.+?)\]$/);
    if (leaderMatch) {
      const playerName = leaderMatch[1];
      const cardId = leaderMatch[2];
      const playerNum = playerMap[playerName];
      if (playerNum === 1) result.player1Leader = cardId;
      if (playerNum === 2) result.player2Leader = cardId;
      result.rawEvents.push({ type: 'header', raw: line, parsed: { player: playerNum, leaderId: cardId } });
      continue;
    }

    // First/second choice
    const orderMatch = line.match(/^\[(.+?)\] Chose to go (First|Second)$/);
    if (orderMatch) {
      const playerName = orderMatch[1];
      const choice = orderMatch[2];
      const playerNum = playerMap[playerName];
      if (playerNum != null) {
        // player "Chose to go Second" means the OTHER player goes first
        result.player1GoesFirst = choice === 'Second' ? playerNum !== 1 : playerNum === 1;
      }
      result.rawEvents.push({ type: 'header', raw: line, parsed: { player: playerNum, choice } });
      continue;
    }

    // Event lines (pipe-delimited)
    if (line.startsWith('RZ1|')) {
      eventLines.push(line);
      continue;
    }

    result.rawEvents.push({ type: 'unknown', raw: line, parsed: {} });
  }

  // Parse event lines into actions grouped by turns
  const actions = [];
  let pendingChk = null;

  for (const line of eventLines) {
    const parts = line.split('|');
    // prefix is parts[0] = "RZ1"

    if (parts[1] === 'CHK') {
      // CHK line: RZ1|CHK|seq|player|f0|f1|...
      const seq = parseInt(parts[2], 10);
      const player = parseInt(parts[3], 10);
      const fields = parts.slice(4).map(Number);
      const chk = {
        seq,
        player,
        // Best-guess field labels based on sample data analysis (see module docblock)
        deckSizeOrConstant: fields[0],  // always 50 in sample
        unknown1: fields[1],
        unknown2: fields[2],
        unknown3: fields[3],
        lifeTotalOrConstant: fields[4], // always 10 in sample
        unknown5: fields[5],
        unknown6: fields[6],
        unknown7: fields[7],
        phaseComplete: fields[8],       // transitions 0->1 when setup phase ends
        unknown9: fields[9],
        rawFields: fields,
      };
      pendingChk = chk;
      result.rawEvents.push({ type: 'chk', raw: line, parsed: chk });

      // Attach to the last action with matching seq
      const matchingAction = actions.findLast((a) => a.seq === seq);
      if (matchingAction) {
        matchingAction.boardStateAfter = chk;
        pendingChk = null;
      }
    } else {
      // ACTION line: RZ1|seq|player|card_id|f4|f5|...
      const seq = parseInt(parts[1], 10);
      const player = parseInt(parts[2], 10);
      const cardId = parts[3];
      const rawFields = parts.slice(4).map(Number);
      const action = {
        seq,
        player,
        cardId,
        // Best-guess field labels based on sample data analysis (see module docblock)
        unknown0: rawFields[0],  // always 0 in sample
        zoneIndex: rawFields[1], // card position in zone (increments across cards in same zone)
        unknown2: rawFields[2],  // always 0 in sample
        phaseCardCount: rawFields[3], // how many cards have been processed in this phase so far
        rawFields,
        boardStateAfter: null,
      };
      actions.push(action);
      result.rawEvents.push({ type: 'action', raw: line, parsed: action });
    }
  }

  // Group actions into turns by player changes
  result.turns = groupIntoTurns(actions);

  return result;
}

/**
 * Groups a flat list of actions into turns.
 * A new turn begins whenever the acting player changes from the previous action.
 * The first player to act is turn 1; the next unique player block is turn 2, etc.
 */
function groupIntoTurns(actions) {
  if (actions.length === 0) return [];

  const turns = [];
  let currentPlayer = actions[0].player;
  let currentActions = [];
  let turnNumber = 1;

  for (const action of actions) {
    if (action.player !== currentPlayer && currentActions.length > 0) {
      turns.push(buildTurn(turnNumber, currentPlayer, currentActions));
      turnNumber++;
      currentPlayer = action.player;
      currentActions = [];
    }
    currentActions.push(action);
  }

  if (currentActions.length > 0) {
    turns.push(buildTurn(turnNumber, currentPlayer, currentActions));
  }

  return turns;
}

function buildTurn(turnNumber, player, actions) {
  const lastAction = actions[actions.length - 1];
  return {
    turnNumber,
    player,
    actions,
    lastBoardState: lastAction.boardStateAfter ?? null,
  };
}
