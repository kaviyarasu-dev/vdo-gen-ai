import type { FastifyInstance } from 'fastify';

import { config } from '../../config/index.js';
import { authenticate } from '../auth/auth.middleware.js';
import { UserController } from './user.controller.js';
import { UserRepository } from './user.repository.js';
import { UserService } from './user.service.js';

export default async function userRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const userRepository = new UserRepository();
  const userService = new UserService(userRepository, config.PROVIDER_KEY_ENCRYPTION_SECRET);
  const userController = new UserController(userService);

  fastify.addHook('preHandler', authenticate);

  // Profile
  fastify.get('/', {
    handler: (request, reply) => userController.getMe(request, reply),
  });

  fastify.patch('/', {
    handler: (request, reply) => userController.updateMe(request, reply),
  });

  // API key management
  fastify.put('/api-keys', {
    handler: (request, reply) => userController.setApiKey(request, reply),
  });

  fastify.get('/api-keys', {
    handler: (request, reply) => userController.getApiKeys(request, reply),
  });

  fastify.delete<{ Params: { provider: string } }>('/api-keys/:provider', {
    handler: (request, reply) => userController.removeApiKey(request, reply),
  });

  // Default provider preferences
  fastify.put('/providers', {
    handler: (request, reply) => userController.updateDefaultProviders(request, reply),
  });
}
