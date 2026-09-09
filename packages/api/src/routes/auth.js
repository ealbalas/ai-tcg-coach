import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const SALT_ROUNDS = 12;

export async function authRoutes(fastify) {
  fastify.post('/api/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let user;
    try {
      const result = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [email.toLowerCase(), passwordHash],
      );
      user = result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Email already registered' });
      }
      throw err;
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return reply.status(201).send({ token, user: { id: user.id, email: user.email } });
  });

  fastify.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    const user = result.rows[0];
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return reply.send({ token, user: { id: user.id, email: user.email } });
  });
}
