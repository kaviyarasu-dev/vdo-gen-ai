import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

interface RateLimiterConfig {
  max: number;
  timeWindow: string;
}

export async function registerRateLimiter(
  app: FastifyInstance,
  config: RateLimiterConfig,
): Promise<void> {
  await app.register(rateLimit, {
    max: config.max,
    timeWindow: config.timeWindow,
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
      },
    }),
  });
}
