import type { FastifyInstance } from 'fastify';

import { authenticate } from '../auth/auth.middleware.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { ProjectService } from '../projects/project.service.js';
import { WorkflowController } from './workflow.controller.js';
import { WorkflowRepository } from './workflow.repository.js';
import { WorkflowService } from './workflow.service.js';

export default async function workflowRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const projectRepository = new ProjectRepository();
  const projectService = new ProjectService(projectRepository);
  const workflowRepository = new WorkflowRepository();
  const workflowService = new WorkflowService(
    workflowRepository,
    projectService,
  );
  const workflowController = new WorkflowController(workflowService);

  fastify.addHook('preHandler', authenticate);

  // Workflow CRUD (scoped to project)
  fastify.get('/', {
    handler: (request, reply) =>
      workflowController.list(
        request as Parameters<typeof workflowController.list>[0],
        reply,
      ),
  });

  fastify.post('/', {
    handler: (request, reply) =>
      workflowController.create(
        request as Parameters<typeof workflowController.create>[0],
        reply,
      ),
  });

  fastify.get('/:workflowId', {
    handler: (request, reply) =>
      workflowController.getById(
        request as Parameters<typeof workflowController.getById>[0],
        reply,
      ),
  });

  fastify.patch('/:workflowId', {
    handler: (request, reply) =>
      workflowController.update(
        request as Parameters<typeof workflowController.update>[0],
        reply,
      ),
  });

  fastify.put('/:workflowId', {
    handler: (request, reply) =>
      workflowController.update(
        request as Parameters<typeof workflowController.update>[0],
        reply,
      ),
  });

  fastify.delete('/:workflowId', {
    handler: (request, reply) =>
      workflowController.delete(
        request as Parameters<typeof workflowController.delete>[0],
        reply,
      ),
  });
}

export async function workflowTemplateRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const projectRepository = new ProjectRepository();
  const projectService = new ProjectService(projectRepository);
  const workflowRepository = new WorkflowRepository();
  const workflowService = new WorkflowService(
    workflowRepository,
    projectService,
  );
  const workflowController = new WorkflowController(workflowService);

  fastify.addHook('preHandler', authenticate);

  // Template endpoints
  fastify.get('/', {
    handler: (request, reply) =>
      workflowController.listTemplates(request, reply),
  });

  fastify.post('/', {
    handler: (request, reply) =>
      workflowController.createTemplate(request, reply),
  });

  fastify.post('/:templateId/clone', {
    handler: (request, reply) =>
      workflowController.cloneTemplate(
        request as Parameters<typeof workflowController.cloneTemplate>[0],
        reply,
      ),
  });
}
