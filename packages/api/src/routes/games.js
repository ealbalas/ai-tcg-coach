import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { pool } from '../db.js';
import { parseLog } from '../parser.js';
import { runHeuristics } from '../coaching.js';
import { authenticate } from '../middleware/auth.js';
import { getCardName } from '../cards.js';

const LOG_DIR = process.env.LOG_DIR || './data/logs';

export async function gamesRoutes(fastify) {
  fastify.post('/api/games/upload', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const rawText = Buffer.concat(chunks).toString('utf8');

    let parsed;
    try {
      parsed = parseLog(rawText);
    } catch (err) {
      return reply.status(422).send({ error: 'Failed to parse log file', detail: err.message });
    }

    // Determine which player the uploader is.
    // We use player 1 as default since we have no way to know which seat the user occupied
    // without them telling us.  In v1, we always coach from player 1's perspective.
    const myPlayer = 1;

    let logPath = null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert game record first (without raw_log_path)
      const gameResult = await client.query(
        `INSERT INTO games
          (user_id, my_leader_card_id, opp_leader_card_id, went_first,
           result, coaching_status, optcgsim_version, room_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          request.userId,
          parsed.player1Leader,
          parsed.player2Leader,
          parsed.player1GoesFirst === true ? true : (parsed.player1GoesFirst === false ? false : null),
          'unknown',
          'pending',
          parsed.version,
          parsed.roomId,
        ],
      );
      const game = gameResult.rows[0];

      // Save raw log to disk
      logPath = join(LOG_DIR, `${game.id}.txt`);
      await mkdir(LOG_DIR, { recursive: true });
      await writeFile(logPath, rawText, 'utf8');

      await client.query('UPDATE games SET raw_log_path = $1 WHERE id = $2', [logPath, game.id]);
      game.raw_log_path = logPath;

      // Insert turns
      const turnIdMap = new Map();
      for (const turn of parsed.turns) {
        const turnResult = await client.query(
          `INSERT INTO turns (game_id, turn_number, player, actions_json, board_state_json)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            game.id,
            turn.turnNumber,
            turn.player,
            JSON.stringify(turn.actions),
            JSON.stringify(turn.lastBoardState),
          ],
        );
        turnIdMap.set(turn.turnNumber, turnResult.rows[0].id);
      }

      // Run heuristics
      const coachingNotes = runHeuristics(parsed, turnIdMap, myPlayer);

      // Insert coaching notes
      const insertedNotes = [];
      for (const note of coachingNotes) {
        const turnId = note.turnNumber != null ? (turnIdMap.get(note.turnNumber) ?? null) : null;
        const noteResult = await client.query(
          `INSERT INTO coaching_notes (game_id, turn_id, layer, severity, text)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [game.id, turnId ?? null, 'rule', note.severity, note.text],
        );
        insertedNotes.push(noteResult.rows[0]);
      }

      // Update coaching status
      await client.query(
        `UPDATE games SET coaching_status = 'heuristic_complete' WHERE id = $1`,
        [game.id],
      );
      game.coaching_status = 'heuristic_complete';

      await client.query('COMMIT');

      return reply.status(201).send({
        game_id: game.id,
        game: {
          ...game,
          coaching_notes: insertedNotes,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (logPath) await unlink(logPath).catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  fastify.get('/api/games', {
    preHandler: authenticate,
  }, async (request) => {
    const result = await pool.query(
      `SELECT id, uploaded_at, my_leader_card_id, opp_leader_card_id,
              went_first, result, coaching_status
       FROM games
       WHERE user_id = $1
       ORDER BY uploaded_at DESC`,
      [request.userId],
    );
    return { games: result.rows };
  });

  fastify.get('/api/games/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params;

    const gameResult = await pool.query(
      'SELECT * FROM games WHERE id = $1 AND user_id = $2',
      [id, request.userId],
    );
    if (gameResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Game not found' });
    }
    const game = gameResult.rows[0];

    const turnsResult = await pool.query(
      'SELECT * FROM turns WHERE game_id = $1 ORDER BY turn_number',
      [id],
    );

    const notesResult = await pool.query(
      'SELECT * FROM coaching_notes WHERE game_id = $1 ORDER BY created_at',
      [id],
    );

    return {
      game,
      my_leader_name: getCardName(game.my_leader_card_id),
      opp_leader_name: getCardName(game.opp_leader_card_id),
      turns: turnsResult.rows,
      coaching_notes: notesResult.rows,
    };
  });
}
