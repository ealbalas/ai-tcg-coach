import { getAllCards } from '../cards.js';
import { authenticate } from '../middleware/auth.js';

export async function cardsRoutes(fastify) {
  fastify.get('/api/cards', { preHandler: authenticate }, async (request) => {
    const { q, type, color } = request.query;

    let cards = getAllCards();

    if (q) {
      const lower = q.toLowerCase();
      cards = cards.filter((c) => c.name.toLowerCase().includes(lower));
    }

    if (type) {
      const lower = type.toLowerCase();
      cards = cards.filter((c) => c.type != null && c.type.toLowerCase() === lower);
    }

    if (color) {
      const lower = color.toLowerCase();
      cards = cards.filter((c) => c.color != null && c.color.toLowerCase().includes(lower));
    }

    return { cards, total: cards.length };
  });
}
