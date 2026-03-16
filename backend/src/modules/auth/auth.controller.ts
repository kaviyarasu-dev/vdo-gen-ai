import type { FastifyRequest, FastifyReply } from 'fastify';
import { ValidationError, UnauthorizedError } from '../../common/errors/index.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema.js';
import type { AuthService } from './auth.service.js';
import type { UserService } from '../users/user.service.js';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  async register(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ValidationError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { user, tokens } = await this.authService.register(parsed.data);
    const publicUser = this.userService.toPublicUser(user);

    reply.status(201).send({
      user: publicUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }

  async login(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ValidationError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { user, tokens } = await this.authService.login(parsed.data);
    const publicUser = this.userService.toPublicUser(user);

    reply.status(200).send({
      user: publicUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }

  async refresh(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = refreshSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ValidationError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const tokens = await this.authService.refresh(parsed.data.refreshToken);

    reply.status(200).send({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }

  async logout(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = refreshSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ValidationError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await this.authService.logout(request.user.userId, parsed.data.refreshToken);

    reply.status(200).send({ message: 'Logged out' });
  }
}
