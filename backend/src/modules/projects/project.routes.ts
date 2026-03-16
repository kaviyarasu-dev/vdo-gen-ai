import type { FastifyInstance } from 'fastify';

import { authenticate } from '../auth/auth.middleware.js';
import { ProjectController } from './project.controller.js';
import { ProjectRepository } from './project.repository.js';
import { ProjectService } from './project.service.js';

export default async function projectRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const projectRepository = new ProjectRepository();
  const projectService = new ProjectService(projectRepository);
  const projectController = new ProjectController(projectService);

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    handler: (request, reply) => projectController.list(request, reply),
  });

  fastify.post('/', {
    handler: (request, reply) => projectController.create(request, reply),
  });

  fastify.get('/:projectId', {
    handler: (request, reply) =>
      projectController.getById(
        request as Parameters<typeof projectController.getById>[0],
        reply,
      ),
  });

  fastify.patch('/:projectId', {
    handler: (request, reply) =>
      projectController.update(
        request as Parameters<typeof projectController.update>[0],
        reply,
      ),
  });

  fastify.delete('/:projectId', {
    handler: (request, reply) =>
      projectController.delete(
        request as Parameters<typeof projectController.delete>[0],
        reply,
      ),
  });
}
