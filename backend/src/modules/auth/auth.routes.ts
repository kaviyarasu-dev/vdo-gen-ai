import type { FastifyInstance } from 'fastify';
import { config } from '../../config/index.js';
import { UserRepository } from '../users/user.repository.js';
import { UserService } from '../users/user.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { authenticate } from './auth.middleware.js';

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // Wire up dependencies
  const userRepository = new UserRepository();
  const userService = new UserService(userRepository);

  const authService = new AuthService({
    userRepository,
    jwtAccessSecret: config.JWT_ACCESS_SECRET,
    jwtRefreshSecret: config.JWT_REFRESH_SECRET,
    accessExpiresIn: config.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
  });

  const authController = new AuthController(authService, userService);

  app.post('/register', async (request, reply) => {
    return authController.register(request, reply);
  });

  app.post('/login', async (request, reply) => {
    return authController.login(request, reply);
  });

  app.post('/refresh', async (request, reply) => {
    return authController.refresh(request, reply);
  });

  app.post('/logout', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      return authController.logout(request, reply);
    },
  });
}
