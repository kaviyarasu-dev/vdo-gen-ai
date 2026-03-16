import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import mongoose from 'mongoose';

import { registerErrorHandler } from '../../src/common/middleware/error-handler.js';
import authRoutes from '../../src/modules/auth/auth.routes.js';
import userRoutes from '../../src/modules/users/user.routes.js';
import projectRoutes from '../../src/modules/projects/project.routes.js';
import assetRoutes from '../../src/modules/assets/asset.routes.js';
import workflowRoutes, { workflowTemplateRoutes } from '../../src/modules/workflows/workflow.routes.js';
import { createExecutionRoutes } from '../../src/modules/executions/execution.routes.js';
import type { WorkflowEngine } from '../../src/engine/engine.js';

/**
 * Creates a stub WorkflowEngine for integration tests.
 * Engine methods that require BullMQ/Redis throw by default;
 * individual tests can override specific methods via the returned reference.
 */
export function createMockEngine(): WorkflowEngine {
  const notImplemented = (method: string) => () => {
    throw new Error(`WorkflowEngine.${method} is not available in test environment`);
  };

  return {
    start: notImplemented('start'),
    pause: notImplemented('pause'),
    resume: notImplemented('resume'),
    cancel: notImplemented('cancel'),
    retry: notImplemented('retry'),
    overrideNode: notImplemented('overrideNode'),
    retryNode: notImplemented('retryNode'),
    getFlowProducer: notImplemented('getFlowProducer'),
  } as unknown as WorkflowEngine;
}

export async function buildTestApp(engine?: WorkflowEngine) {
  const app = fastify({
    logger: false,
    requestTimeout: 10_000,
    bodyLimit: 1_048_576,
  });

  await app.register(cors, { origin: true, credentials: true });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 10,
    },
  });

  registerErrorHandler(app);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }));

  // Register API routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users/me' });
  await app.register(projectRoutes, { prefix: '/api/v1/projects' });
  await app.register(assetRoutes, { prefix: '/api/v1' });
  await app.register(workflowRoutes, { prefix: '/api/v1/projects/:projectId/workflows' });
  await app.register(workflowTemplateRoutes, { prefix: '/api/v1/workflow-templates' });

  // Execution routes - use provided engine or a mock stub
  const resolvedEngine = engine ?? createMockEngine();
  await app.register(createExecutionRoutes(resolvedEngine), { prefix: '/api/v1/executions' });

  await app.ready();
  return app;
}
