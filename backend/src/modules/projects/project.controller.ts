import type { FastifyRequest, FastifyReply } from 'fastify';

import { UnauthorizedError, ValidationError } from '../../common/errors/index.js';
import type { ProjectService } from './project.service.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
} from './project.schema.js';

export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  async create(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid project data', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const project = await this.projectService.create(
      request.user.userId,
      parsed.data,
    );

    reply.status(201).send({ data: project });
  }

  async getById(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const project = await this.projectService.getById(
      request.params.projectId,
      request.user.userId,
    );

    reply.status(200).send({ data: project });
  }

  async list(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = listProjectsSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await this.projectService.list(
      request.user.userId,
      parsed.data,
    );

    reply.status(200).send(result);
  }

  async update(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = updateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid project data', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const project = await this.projectService.update(
      request.params.projectId,
      request.user.userId,
      parsed.data,
    );

    reply.status(200).send({ data: project });
  }

  async delete(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    await this.projectService.archive(
      request.params.projectId,
      request.user.userId,
    );

    reply.status(200).send({ message: 'Project archived successfully' });
  }
}
