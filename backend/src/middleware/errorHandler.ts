import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _req, reply) => {
    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation error',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    // JWT errors
    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
        error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Postgres unique violation
    if ((error as any).code === '23505') {
      return reply.status(409).send({ error: 'Already exists' });
    }

    // Postgres foreign key violation
    if ((error as any).code === '23503') {
      return reply.status(400).send({ error: 'Referenced resource not found' });
    }

    app.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  });
}
