import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { z } from 'zod';
import crypto from 'crypto';

const CreateEntrySchema = z.object({
  title: z.string().max(256).optional(),
  output: z.string().max(10 * 1024 * 1024),
  command: z.string().max(4096).optional(),
  tags: z.array(z.string().max(64)).max(20).default([]),
  exit_code: z.number().int().optional(),
  is_public: z.boolean().default(false),
  hostname: z.string().optional(),
  working_dir: z.string().optional(),
  workspace_id: z.string().uuid().optional(),
});

const UpdateTagsSchema = z.object({
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
});

export async function entryRoutes(app: FastifyInstance) {
  // Create entry
  app.post('/entries', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const body = CreateEntrySchema.parse(req.body);

    const shareToken = body.is_public ? crypto.randomBytes(12).toString('hex') : null;

    const result = await pool.query(
      `INSERT INTO entries
        (user_id, workspace_id, title, output, command, tags, exit_code, is_public, share_token, hostname, working_dir)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, title, output, command, tags, exit_code, is_public, share_token, created_at`,
      [
        userId,
        body.workspace_id ?? null,
        body.title ?? null,
        body.output,
        body.command ?? null,
        body.tags,
        body.exit_code ?? null,
        body.is_public,
        shareToken,
        body.hostname ?? null,
        body.working_dir ?? null,
      ]
    );

    return reply.status(201).send(result.rows[0]);
  });

  // List entries
  app.get('/entries', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const query = req.query as { limit?: string; tag?: string; workspace_id?: string };
    const limit = Math.min(parseInt(query.limit ?? '20'), 100);

    let sql = `SELECT id, title, output, command, tags, exit_code, is_public, share_token, created_at
               FROM entries WHERE user_id = $1`;
    const params: any[] = [userId];

    if (query.tag) {
      params.push(query.tag);
      sql += ` AND $${params.length} = ANY(tags)`;
    }

    if (query.workspace_id) {
      params.push(query.workspace_id);
      sql += ` AND workspace_id = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(sql, params);
    return reply.send(result.rows);
  });

  // Search entries
  app.get('/entries/search', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const { q } = req.query as { q: string };

    if (!q || q.trim().length === 0) {
      return reply.send([]);
    }

    const result = await pool.query(
      `SELECT id, title, output, command, tags, exit_code, is_public, share_token, created_at,
              ts_rank(search_vector, plainto_tsquery('english', $2)) as rank
       FROM entries
       WHERE user_id = $1
         AND search_vector @@ plainto_tsquery('english', $2)
       ORDER BY rank DESC, created_at DESC
       LIMIT 50`,
      [userId, q]
    );

    return reply.send(result.rows);
  });

  // Get single entry
  app.get('/entries/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const idRaw = (req.params as { id: string }).id.trim();
    // Avoid invalid `uuid = $1` casts for short prefixes (CLI lists first 8 hex chars).
    if (idRaw.length < 4 || !/^[0-9a-fA-F-]+$/.test(idRaw)) {
      return reply.status(400).send({ error: 'Invalid id' });
    }
    const idLower = idRaw.toLowerCase();

    const result = await pool.query(
      `SELECT id, title, output, command, tags, exit_code, is_public, share_token, created_at
       FROM entries
       WHERE user_id = $1
         AND (lower(id::text) = $2 OR lower(id::text) LIKE $3)`,
      [userId, idLower, `${idLower}%`]
    );

    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    if (result.rows.length > 1) return reply.status(400).send({ error: 'Ambiguous id prefix' });
    return reply.send(result.rows[0]);
  });

  // Share entry
  app.post('/entries/:id/share', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const { id } = req.params as { id: string };

    const shareToken = crypto.randomBytes(12).toString('hex');

    const result = await pool.query(
      `UPDATE entries SET is_public = TRUE, share_token = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, tags, is_public, share_token, created_at`,
      [shareToken, id, userId]
    );

    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    return reply.send(result.rows[0]);
  });

  // Unshare entry
  app.delete('/entries/:id/share', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const { id } = req.params as { id: string };

    await pool.query(
      `UPDATE entries SET is_public = FALSE, share_token = NULL WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return reply.send({ ok: true });
  });

  // Get shared entry (public, no auth)
  app.get('/s/:token', async (req, reply) => {
    const { token } = req.params as { token: string };

    const result = await pool.query(
      `SELECT e.id, e.title, e.output, e.command, e.tags, e.exit_code, e.created_at,
              u.name as author_name
       FROM entries e
       JOIN users u ON u.id = e.user_id
       WHERE e.share_token = $1 AND e.is_public = TRUE`,
      [token]
    );

    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    return reply.send(result.rows[0]);
  });

  // Update tags
  app.patch('/entries/:id/tags', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const { id } = req.params as { id: string };
    const { add, remove } = UpdateTagsSchema.parse(req.body);

    let sql = 'UPDATE entries SET tags = tags';
    const params: any[] = [id, userId];

    if (add.length > 0) {
      params.push(add);
      sql += ` || $${params.length}::text[]`;
    }
    if (remove.length > 0) {
      params.push(remove);
      sql += ` - $${params.length}::text[]`;
    }

    sql += `, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING tags`;

    const result = await pool.query(sql, params);
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    return reply.send(result.rows[0]);
  });

  // Delete entry
  app.delete('/entries/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const { id } = req.params as { id: string };

    await pool.query('DELETE FROM entries WHERE id = $1 AND user_id = $2', [id, userId]);
    return reply.status(204).send();
  });
}
