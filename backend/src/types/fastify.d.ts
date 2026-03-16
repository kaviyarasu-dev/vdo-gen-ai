import type { FastifyInstance as _FI } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
    };
  }
}
