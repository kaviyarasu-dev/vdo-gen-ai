import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { UnauthorizedError, ValidationError } from '../../common/errors/index.js';
import type { UserService } from './user.service.js';
import type { UpdateUserDto, IUserDefaultProviders } from './user.types.js';

const setApiKeySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
});

const updateProvidersSchema = z.object({
  textAnalysis: z.string().optional(),
  imageGeneration: z.string().optional(),
  videoGeneration: z.string().optional(),
});

export class UserController {
  constructor(private readonly userService: UserService) {}

  async getMe(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await this.userService.getProfile(request.user.userId);
    const publicUser = this.userService.toPublicUser(user);

    reply.status(200).send({ data: publicUser });
  }

  async updateMe(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const updateData = request.body as UpdateUserDto;
    const user = await this.userService.updateProfile(
      request.user.userId,
      updateData,
    );
    const publicUser = this.userService.toPublicUser(user);

    reply.status(200).send({ data: publicUser });
  }

  // ── API Key Management ──

  async setApiKey(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = setApiKeySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request body', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    await this.userService.setProviderApiKey(
      request.user.userId,
      parsed.data.provider,
      parsed.data.apiKey,
    );

    reply.status(200).send({ data: { message: 'API key stored' } });
  }

  async getApiKeys(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const keys = await this.userService.getProviderApiKeys(request.user.userId);

    reply.status(200).send({ data: keys });
  }

  async removeApiKey(
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { provider } = request.params;
    await this.userService.removeProviderApiKey(request.user.userId, provider);

    reply.status(200).send({ data: { message: 'API key removed' } });
  }

  // ── Default Provider Preferences ──

  async updateDefaultProviders(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = updateProvidersSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request body', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const user = await this.userService.updateDefaultProviders(
      request.user.userId,
      parsed.data as IUserDefaultProviders,
    );
    const publicUser = this.userService.toPublicUser(user);

    reply.status(200).send({ data: publicUser });
  }
}
