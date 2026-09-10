import { Queue, Worker } from 'bullmq';
import Anthropic from '@anthropic-ai/sdk';
import { pool } from './db.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function redisConnection() {
  const url = new URL(REDIS_URL);
  const opts = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
  };
  if (url.username) opts.username = decodeURIComponent(url.username);
  if (url.password) opts.password = decodeURIComponent(url.password);
  return opts;
}

export const coachingQueue = new Queue('coaching', { connection: redisConnection() });

function buildPrompt(summary) {
  const turnLines = summary.turns
    .filter((t) => t.isMyTurn)
    .map((t) => {
      const cardList = t.cards
        .map((c) => {
          const label = c.name ?? c.id;
          return c.type ? `${label} [${c.type}]` : label;
        })
        .join(', ') || 'nothing recorded';
      return `Turn ${t.turnNumber} (Mine): played ${cardList}`;
    })
    .join('\n');

  return `You are an expert One Piece TCG coach. Analyze this game and provide coaching feedback.

My leader: ${summary.myLeader.name ?? summary.myLeader.id} (${summary.myLeader.id})
Opponent's leader: ${summary.oppLeader.name ?? summary.oppLeader.id} (${summary.oppLeader.id})

Turn-by-turn play:
${turnLines || 'No turns recorded.'}

Please provide:
1. A brief overall game assessment (2-3 sentences)
2. For each of MY turns, specific coaching: what was good, what better options might exist, and why

Format your response as JSON:
{
  "overall": "string",
  "turns": [
    { "turnNumber": N, "feedback": "string" }
  ]
}
Only include MY turns (not opponent turns) in the turns array.
Keep each feedback under 100 words. Be specific and actionable.`;
}

async function processCoachingJob(job) {
  const { gameId, parsedSummary } = job.data;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let llmResult;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(parsedSummary) }],
    });

    const text = message.content.find((b) => b.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in LLM response');
    llmResult = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[coaching-worker] LLM call failed for game ${gameId}:`, err);
    await pool.query(`UPDATE games SET coaching_status = 'error' WHERE id = $1`, [gameId])
      .catch((e) => console.error('[coaching-worker] Failed to update status to error:', e));
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Look up turn IDs for the game
    const turnsResult = await client.query(
      'SELECT id, turn_number FROM turns WHERE game_id = $1',
      [gameId],
    );
    const turnIdByNumber = new Map(turnsResult.rows.map((r) => [r.turn_number, r.id]));

    // Overall note (no turn)
    if (llmResult.overall) {
      await client.query(
        `INSERT INTO coaching_notes (game_id, turn_id, layer, severity, text)
         VALUES ($1, NULL, 'llm', 'info', $2)`,
        [gameId, llmResult.overall],
      );
    }

    // Per-turn notes
    if (Array.isArray(llmResult.turns)) {
      for (const t of llmResult.turns) {
        const turnId = turnIdByNumber.get(Number(t.turnNumber)) ?? null;
        if (t.feedback) {
          await client.query(
            `INSERT INTO coaching_notes (game_id, turn_id, layer, severity, text)
             VALUES ($1, $2, 'llm', 'info', $3)`,
            [gameId, turnId, t.feedback],
          );
        }
      }
    }

    await client.query(`UPDATE games SET coaching_status = 'done' WHERE id = $1`, [gameId]);
    await client.query('COMMIT');
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error(`[coaching-worker] DB write failed for game ${gameId}:`, err);
    await pool.query(`UPDATE games SET coaching_status = 'error' WHERE id = $1`, [gameId])
      .catch((e) => console.error('[coaching-worker] Failed to update status to error:', e));
  } finally {
    if (client) client.release();
  }
}

export function startWorker() {
  const worker = new Worker('coaching', processCoachingJob, { connection: redisConnection() });

  worker.on('failed', (job, err) => {
    console.error(`[coaching-worker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
