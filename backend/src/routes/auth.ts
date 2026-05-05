import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/auth/register', async (req, reply) => {
    const body = RegisterSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(body.password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [body.email, hash, body.name ?? null]
    );

    const user = result.rows[0];

    // Create default personal workspace
    await pool.query(
      'INSERT INTO workspaces (name, owner_id) VALUES ($1, $2)',
      ['Personal', user.id]
    );

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    return reply.status(201).send({ token, user });
  });

  // Login
  app.post('/auth/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [body.email]);
    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(body.password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    return reply.send({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  });

  // Me
  app.get('/auth/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string; email: string };
    const result = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) return reply.status(404).send({ error: 'User not found' });
    return reply.send(result.rows[0]);
  });
}
