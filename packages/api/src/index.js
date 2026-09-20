import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { pool } from './db.js';
import { authRoutes } from './routes/auth.js';
import { gamesRoutes } from './routes/games.js';
import { cardsRoutes } from './routes/cards.js';
import { loadCards } from './cards.js';
import { coachingQueue, startWorker } from './queue.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB limit

fastify.get('/health', async () => ({ ok: true }));

await fastify.register(authRoutes);
await fastify.register(gamesRoutes, { coachingQueue });
await fastify.register(cardsRoutes);

// Run migrations on startup
async function runMigrations() {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(__dirname, '..', 'migrations', '001_initial.sql'), 'utf8');
  await pool.query(sql);
  fastify.log.info('Migrations applied');
}

const PORT = parseInt(process.env.PORT || '3001', 10);

try {
  await runMigrations();
  // Synchronous: loads bundled snapshot immediately, then triggers background refresh
  loadCards();
  const worker = startWorker();
  fastify.addHook('onClose', async () => { await worker.close(); });
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
