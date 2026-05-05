import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import 'dotenv/config';
import './types.d';

import { authRoutes } from './routes/auth';
import { entryRoutes } from './routes/entries';
import { workspaceRoutes } from './routes/workspaces';
import { registerErrorHandler } from './middleware/errorHandler';

const app = Fastify({ logger: true });

// Plugins
app.register(cors, {
  origin: process.env.WEB_URL ?? 'http://localhost:5173',
  credentials: true,
});

app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'change-me-in-production',
});

// Auth decorator
app.decorate('authenticate', async function (req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Error handling
registerErrorHandler(app);

// Routes
app.register(authRoutes);
app.register(entryRoutes);
app.register(workspaceRoutes);

// Health check
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

// Start
const port = parseInt(process.env.PORT ?? '3001');
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`✓ API running on http://localhost:${port}`);
});
