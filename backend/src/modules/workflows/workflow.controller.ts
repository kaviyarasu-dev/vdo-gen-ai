import type { FastifyRequest, FastifyReply } from 'fastify';

import { UnauthorizedError, ValidationError } from '../../common/errors/index.js';
import type { WorkflowService } from './workflow.service.js';
import type { IWorkflowDocument } from './workflow.types.js';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  listWorkflowsSchema,
  createTemplateSchema,
  cloneTemplateSchema,
} from './workflow.schema.js';

function toWorkflowResponse(workflow: IWorkflowDocument): Record<string, unknown> {
  const obj = workflow.toObject();
  const { nodes, edges, ...rest } = obj;
  return {
    ...rest,
    definition: { nodes, edges },
  };
}

export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  async create(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = createWorkflowSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid workflow data', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const workflow = await this.workflowService.create(
      request.params.projectId,
      request.user.userId,
      parsed.data,
    );

    reply.status(201).send({ data: toWorkflowResponse(workflow) });
  }

  async getById(
    request: FastifyRequest<{
      Params: { projectId: string; workflowId: string };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const workflow = await this.workflowService.getById(
      request.params.workflowId,
      request.params.projectId,
      request.user.userId,
    );

    reply.status(200).send({ data: toWorkflowResponse(workflow) });
  }

  async list(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = listWorkflowsSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await this.workflowService.list(
      request.params.projectId,
      request.user.userId,
      parsed.data,
    );

    reply.status(200).send({
      ...result,
      data: result.data.map(toWorkflowResponse),
    });
  }

  async update(
    request: FastifyRequest<{
      Params: { projectId: string; workflowId: string };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = updateWorkflowSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid workflow data', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const workflow = await this.workflowService.update(
      request.params.workflowId,
      request.params.projectId,
      request.user.userId,
      parsed.data,
    );

    reply.status(200).send({ data: toWorkflowResponse(workflow) });
  }

  async delete(
    request: FastifyRequest<{
      Params: { projectId: string; workflowId: string };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    await this.workflowService.delete(
      request.params.workflowId,
      request.params.projectId,
      request.user.userId,
    );

    reply.status(200).send({ message: 'Workflow deleted successfully' });
  }

  // Template handlers

  async createTemplate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = createTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid template data', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const template = await this.workflowService.saveAsTemplate(
      request.user.userId,
      parsed.data,
    );

    reply.status(201).send({ data: toWorkflowResponse(template) });
  }

  async listTemplates(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = listWorkflowsSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await this.workflowService.listTemplates(parsed.data);

    reply.status(200).send({
      ...result,
      data: result.data.map(toWorkflowResponse),
    });
  }

  async cloneTemplate(
    request: FastifyRequest<{ Params: { templateId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = cloneTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid clone data', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const workflow = await this.workflowService.cloneTemplate(
      request.params.templateId,
      request.user.userId,
      parsed.data,
    );

    reply.status(201).send({ data: toWorkflowResponse(workflow) });
  }
}
