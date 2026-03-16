import type { FastifyInstance } from 'fastify';

import { config } from '../../config/index.js';
import { authenticate } from '../auth/auth.middleware.js';
import { createStorageAdapter } from '../../storage/storage.factory.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { ProjectService } from '../projects/project.service.js';
import { AssetController } from './asset.controller.js';
import { AssetRepository } from './asset.repository.js';
import { AssetService } from './asset.service.js';

export default async function assetRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const storageAdapter = createStorageAdapter(config.STORAGE_DRIVER, config.STORAGE_PATH);
  const projectRepository = new ProjectRepository();
  const projectService = new ProjectService(projectRepository);
  const assetRepository = new AssetRepository();
  const assetService = new AssetService({
    assetRepository,
    projectService,
    storageAdapter,
  });
  const assetController = new AssetController(assetService);

  fastify.addHook('preHandler', authenticate);

  // Project-scoped asset routes
  fastify.get('/projects/:projectId/assets', {
    handler: (request, reply) =>
      assetController.listByProject(
        request as Parameters<typeof assetController.listByProject>[0],
        reply,
      ),
  });

  fastify.post('/projects/:projectId/assets/upload', {
    handler: (request, reply) =>
      assetController.upload(
        request as Parameters<typeof assetController.upload>[0],
        reply,
      ),
  });

  // Direct asset routes
  fastify.get('/assets/:assetId', {
    handler: (request, reply) =>
      assetController.getById(
        request as Parameters<typeof assetController.getById>[0],
        reply,
      ),
  });

  fastify.get('/assets/:assetId/download', {
    handler: (request, reply) =>
      assetController.download(
        request as Parameters<typeof assetController.download>[0],
        reply,
      ),
  });

  fastify.delete('/assets/:assetId', {
    handler: (request, reply) =>
      assetController.deleteAsset(
        request as Parameters<typeof assetController.deleteAsset>[0],
        reply,
      ),
  });
}
