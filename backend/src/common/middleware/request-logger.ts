import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { logger } from '../utils/logger.js';

export function registerRequestLogger(app: FastifyInstance): void {
  app.addHook(
    'onRequest',
    (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
      logger.info(
        { reqId: request.id, method: request.method, url: request.url },
        'Incoming request',
      );
      done();
    },
  );

  app.addHook(
    'onResponse',
    (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
      logger.info(
        {
          reqId: request.id,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTimeMs: reply.elapsedTime,
        },
        'Request completed',
      );
      done();
    },
  );
}
