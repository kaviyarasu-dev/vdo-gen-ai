import { config } from './config/index.js';
import { logger } from './common/utils/logger.js';
import { buildApp } from './app.js';

async function main() {
  try {
    const app = await buildApp();

    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(
      { port: config.PORT, host: config.HOST, env: config.NODE_ENV },
      'Server started',
    );
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
