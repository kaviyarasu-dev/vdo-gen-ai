import { Redis } from 'ioredis';
import { logger } from '../common/utils/logger.js';

export function createRedisClient(host: string, port: number): Redis {
  const client = new Redis({ host, port, maxRetriesPerRequest: 3 });

  client.on('connect', () => {
    logger.info({ host, port }, 'Redis connected successfully');
  });

  client.on('error', (error: Error) => {
    logger.error({ err: error }, 'Redis connection error');
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return client;
}

export async function disconnectRedis(client: Redis): Promise<void> {
  await client.quit();
  logger.info('Redis disconnected gracefully');
}
