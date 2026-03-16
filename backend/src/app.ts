import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import mongoose from 'mongoose';

import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { createRedisClient, disconnectRedis } from './config/redis.js';
import { registerErrorHandler } from './common/middleware/error-handler.js';
import { registerRequestLogger } from './common/middleware/request-logger.js';
import { registerRateLimiter } from './common/middleware/rate-limiter.js';
import { logger } from './common/utils/logger.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import assetRoutes from './modules/assets/asset.routes.js';
import workflowRoutes, { workflowTemplateRoutes } from './modules/workflows/workflow.routes.js';
import { createProviderRegistry } from './providers/provider.factory.js';
import { createProviderRoutes } from './providers/provider.routes.js';
import { QueueManager } from './queue/queue.manager.js';
import { QUEUES, type QueueName } from './queue/queue.types.js';
import { WorkflowEngine } from './engine/engine.js';
import { createTextAnalysisWorker } from './queue/workers/text-analysis.worker.js';
import { createImageGenerationWorker } from './queue/workers/image-generation.worker.js';
import { createVideoGenerationWorker } from './queue/workers/video-generation.worker.js';
import { createVideoCombineWorker } from './queue/workers/video-combine.worker.js';
import { createOrchestrationWorker } from './queue/workers/orchestration.worker.js';
import { createExecutionRoutes } from './modules/executions/execution.routes.js';
import { createWebhookRoutes } from './modules/webhooks/webhook.routes.js';
import { socketManager } from './realtime/socket.manager.js';

export async function buildApp() {
  const app = fastify({
    logger: false,
    requestTimeout: 30_000,
    bodyLimit: 1_048_576,
  });

  // Security plugins
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });
  await app.register(helmet);

  // File upload support
  await app.register(multipart, {
    limits: {
      fileSize: config.UPLOAD_MAX_FILE_SIZE,
      files: 10,
    },
  });

  // Middleware
  registerErrorHandler(app);
  registerRequestLogger(app);
  await registerRateLimiter(app, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
  });

  // OpenAPI / Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'VDO Gen API',
        description: 'AI Video Generation Workflow API',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Connect to databases
  await connectDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
  const redisClient = createRedisClient(config.REDIS_HOST, config.REDIS_PORT);

  // Redis connection config for BullMQ (separate from ioredis client)
  const bullmqConnection = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
  };

  // Queue infrastructure
  const queueManager = new QueueManager(bullmqConnection);
  await queueManager.initialize();

  // Provider registry
  const providerRegistry = createProviderRegistry(config);

  // Workflow engine
  const engine = new WorkflowEngine(queueManager);

  // Start workers
  const workers = [
    createTextAnalysisWorker(bullmqConnection, providerRegistry, queueManager),
    createImageGenerationWorker(bullmqConnection, providerRegistry),
    createVideoGenerationWorker(bullmqConnection, providerRegistry),
    createVideoCombineWorker(bullmqConnection),
    createOrchestrationWorker(bullmqConnection, queueManager),
  ];

  // Health check
  app.get('/health', async () => {
    const LATENCY_THRESHOLD_MS = 500;

    // MongoDB check
    let mongoStatus: 'connected' | 'disconnected' = 'disconnected';
    let mongoLatencyMs = -1;
    try {
      const mongoStart = performance.now();
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        mongoLatencyMs = Math.round(performance.now() - mongoStart);
        mongoStatus = 'connected';
      }
    } catch {
      mongoStatus = 'disconnected';
    }

    // Redis check
    let redisStatus: string = redisClient.status;
    let redisLatencyMs = -1;
    try {
      const redisStart = performance.now();
      await redisClient.ping();
      redisLatencyMs = Math.round(performance.now() - redisStart);
      redisStatus = 'connected';
    } catch {
      redisStatus = 'disconnected';
    }

    // Queue stats
    const queueNames = Object.values(QUEUES) as QueueName[];
    const queueStats: Record<string, { waiting: number; active: number; failed: number }> = {};
    for (const name of queueNames) {
      try {
        const queue = queueManager.getQueue(name);
        const counts = await queue.getJobCounts('waiting', 'active', 'failed');
        queueStats[name] = {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          failed: counts.failed ?? 0,
        };
      } catch {
        queueStats[name] = { waiting: -1, active: -1, failed: -1 };
      }
    }

    // Determine overall status
    const isMongoDown = mongoStatus === 'disconnected';
    const isRedisDown = redisStatus === 'disconnected';
    const isHighLatency =
      (mongoLatencyMs > LATENCY_THRESHOLD_MS) ||
      (redisLatencyMs > LATENCY_THRESHOLD_MS);

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (isMongoDown || isRedisDown) {
      status = 'unhealthy';
    } else if (isHighLatency) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: {
          status: mongoStatus,
          latencyMs: mongoLatencyMs,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
        },
      },
      queues: queueStats,
    };
  });

  // API routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users/me' });
  await app.register(projectRoutes, { prefix: '/api/v1/projects' });
  await app.register(assetRoutes, { prefix: '/api/v1' });
  await app.register(workflowRoutes, { prefix: '/api/v1/projects/:projectId/workflows' });
  await app.register(workflowTemplateRoutes, { prefix: '/api/v1/workflow-templates' });
  await app.register(createProviderRoutes(providerRegistry), { prefix: '/api/v1/providers' });
  await app.register(createExecutionRoutes(engine), { prefix: '/api/v1/executions' });
  await app.register(createWebhookRoutes(providerRegistry, config), { prefix: '/api/v1/webhooks' });

  // Socket.io – attach to the underlying HTTP server.
  // The raw server is available after Fastify has been constructed;
  // it starts accepting connections only after app.listen().
  const corsOrigin = config.NODE_ENV === 'production' ? false : true;
  socketManager.initialize(app.server, corsOrigin);

  // Graceful shutdown helper with 30-second hard timeout
  const SHUTDOWN_TIMEOUT_MS = 30_000;

  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal — beginning graceful shutdown');

    // Force exit after 30 seconds if graceful shutdown stalls
    const forceExitTimer = setTimeout(() => {
      logger.error(
        { timeoutMs: SHUTDOWN_TIMEOUT_MS },
        'Graceful shutdown timed out — forcing exit',
      );
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    try {
      // Phase 1: Stop accepting new requests
      logger.info('Shutdown phase 1: closing HTTP server');
      await app.close();
      logger.info('HTTP server closed');

      // Phase 2: Close workers (stop processing new jobs)
      logger.info('Shutdown phase 2: closing BullMQ workers');
      for (const worker of workers) {
        await worker.close();
      }
      logger.info('Workers closed');

      // Phase 3: Close queue manager (queues + FlowProducer)
      logger.info('Shutdown phase 3: closing queue manager');
      await queueManager.shutdown();
      logger.info('Queue manager closed');

      // Phase 4: Close Socket.io
      logger.info('Shutdown phase 4: closing Socket.io');
      await socketManager.shutdown();
      logger.info('Socket.io closed');

      // Phase 5: Close Redis
      logger.info('Shutdown phase 5: disconnecting Redis');
      await disconnectRedis(redisClient);
      logger.info('Redis disconnected');

      // Phase 6: Close MongoDB
      logger.info('Shutdown phase 6: disconnecting MongoDB');
      await mongoose.disconnect();
      logger.info('MongoDB disconnected');

      clearTimeout(forceExitTimer);
      logger.info('Server shut down gracefully');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during graceful shutdown — forcing exit');
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return app;
}
