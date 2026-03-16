import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { ExecutionController } from './execution.controller.js';
import type { WorkflowEngine } from '../../engine/engine.js';

export function createExecutionRoutes(engine: WorkflowEngine) {
  return async function executionRoutes(
    fastify: FastifyInstance,
  ): Promise<void> {
    const controller = new ExecutionController(engine);

    fastify.addHook('preHandler', authenticate);

    // Start a new execution
    fastify.post('/', {
      handler: (request, reply) =>
        controller.start(
          request as Parameters<typeof controller.start>[0],
          reply,
        ),
    });

    // List executions
    fastify.get('/', {
      handler: (request, reply) =>
        controller.list(
          request as Parameters<typeof controller.list>[0],
          reply,
        ),
    });

    // Get execution by ID
    fastify.get('/:executionId', {
      handler: (request, reply) =>
        controller.getById(
          request as Parameters<typeof controller.getById>[0],
          reply,
        ),
    });

    // Pause execution
    fastify.post('/:executionId/pause', {
      handler: (request, reply) =>
        controller.pause(
          request as Parameters<typeof controller.pause>[0],
          reply,
        ),
    });

    // Resume execution
    fastify.post('/:executionId/resume', {
      handler: (request, reply) =>
        controller.resume(
          request as Parameters<typeof controller.resume>[0],
          reply,
        ),
    });

    // Cancel execution
    fastify.post('/:executionId/cancel', {
      handler: (request, reply) =>
        controller.cancel(
          request as Parameters<typeof controller.cancel>[0],
          reply,
        ),
    });

    // Retry failed execution
    fastify.post('/:executionId/retry', {
      handler: (request, reply) =>
        controller.retry(
          request as Parameters<typeof controller.retry>[0],
          reply,
        ),
    });

    // Get single node state + output
    fastify.get('/:executionId/nodes/:nodeId', {
      handler: (request, reply) =>
        controller.getNodeState(
          request as Parameters<typeof controller.getNodeState>[0],
          reply,
        ),
    });

    // Override a failed node with an external asset
    fastify.post('/:executionId/nodes/:nodeId/override', {
      handler: (request, reply) =>
        controller.overrideNode(
          request as Parameters<typeof controller.overrideNode>[0],
          reply,
        ),
    });

    // Retry a single failed node
    fastify.post('/:executionId/nodes/:nodeId/retry', {
      handler: (request, reply) =>
        controller.retryNode(
          request as Parameters<typeof controller.retryNode>[0],
          reply,
        ),
    });
  };
}
