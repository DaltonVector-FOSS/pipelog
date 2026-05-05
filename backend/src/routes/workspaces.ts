import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { z } from 'zod';

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(64),
});

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export async function workspaceRoutes(app: FastifyInstance) {
  // List workspaces for user
  app.get('/workspaces', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };

    const result = await pool.query(
      `SELECT w.id, w.name, w.owner_id, w.created_at, wm.role,
              (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
       ORDER BY w.created_at`,
      [userId]
    );

    return reply.send(result.rows);
  });

  // Create workspace
  app.post('/workspaces', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const { name } = CreateWorkspaceSchema.parse(req.body);

    const ws = await pool.query(
      'INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING *',
      [name, userId]
    );

    await pool.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [ws.rows[0].id, userId, 'admin']
    );

    return reply.status(201).send(ws.rows[0]);
  });

  // Get workspace members
  app.get('/workspaces/:id/members', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { userId } = req.user as { userId: string };

    // Verify membership
    const member = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );
    if (member.rows.length === 0) return reply.status(403).send({ error: 'Forbidden' });

    const result = await pool.query(
      `SELECT u.id, u.email, u.name, wm.role, wm.joined_at
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY wm.joined_at`,
      [id]
    );

    return reply.send(result.rows);
  });

  // Invite user to workspace
  app.post('/workspaces/:id/invite', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { userId } = req.user as { userId: string };
    const { email, role } = InviteSchema.parse(req.body);

    // Check requester is admin
    const member = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (member.rows.length === 0 || member.rows[0].role !== 'admin') {
      return reply.status(403).send({ error: 'Only admins can invite' });
    }

    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }

    await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [id, user.rows[0].id, role]
    );

    return reply.send({ ok: true });
  });
}
