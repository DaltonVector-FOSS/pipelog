import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const MAX_BYTES = 256 * 1024;

const ClipboardBodySchema = z.object({
  text: z.string().max(MAX_BYTES),
});

/** In-memory only — clipboard text is never written to Postgres or route logs */
const store = new Map<string, { text: string; updated_at: number }>();

export async function syncClipboardRoutes(app: FastifyInstance) {
  app.get(
    '/sync/clipboard',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { userId } = req.user as { userId: string };
      const hit = store.get(userId);
      if (!hit) {
        return reply.send({ text: '', updated_at: 0 });
      }
      return reply.send({ text: hit.text, updated_at: hit.updated_at });
    }
  );

  app.post(
    '/sync/clipboard',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { userId } = req.user as { userId: string };
      const body = ClipboardBodySchema.parse(req.body);
      const updated_at = Date.now();
      store.set(userId, { text: body.text, updated_at });
      return reply.send({ updated_at });
    }
  );
}
