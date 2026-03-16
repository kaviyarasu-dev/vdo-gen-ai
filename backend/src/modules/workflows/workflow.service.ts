import { ForbiddenError, NotFoundError } from '../../common/errors/index.js';
import { logger } from '../../common/utils/logger.js';
import type { ProjectService } from '../projects/project.service.js';
import type { WorkflowRepository } from './workflow.repository.js';
import type {
  IWorkflowDocument,
  CreateWorkflowDto,
  UpdateWorkflowDto,
  ListWorkflowsQuery,
  CreateTemplateDto,
  CloneTemplateDto,
} from './workflow.types.js';
import type { PaginatedResult } from '../projects/project.types.js';

export class WorkflowService {

  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly projectService: ProjectService,
  ) {}

  async create(
    projectId: string,
    userId: string,
    data: CreateWorkflowDto,
  ): Promise<IWorkflowDocument> {
    // Verify project ownership
    await this.projectService.getById(projectId, userId);

    const workflow = await this.workflowRepository.create(
      projectId,
      userId,
      data,
    );

    logger.info(
      { workflowId: workflow._id, projectId, userId },
      'Workflow created',
    );

    return workflow;
  }

  async getById(
    workflowId: string,
    projectId: string,
    userId: string,
  ): Promise<IWorkflowDocument> {
    // Verify project ownership
    await this.projectService.getById(projectId, userId);

    const workflow = await this.workflowRepository.findByIdAndProject(
      workflowId,
      projectId,
    );

    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    return workflow;
  }

  async list(
    projectId: string,
    userId: string,
    query: ListWorkflowsQuery,
  ): Promise<PaginatedResult<IWorkflowDocument>> {
    // Verify project ownership
    await this.projectService.getById(projectId, userId);

    return this.workflowRepository.listByProject(projectId, query);
  }

  async update(
    workflowId: string,
    projectId: string,
    userId: string,
    data: UpdateWorkflowDto,
  ): Promise<IWorkflowDocument> {
    // Verify project ownership
    await this.projectService.getById(projectId, userId);

    const existing = await this.workflowRepository.findByIdAndProject(
      workflowId,
      projectId,
    );

    if (!existing) {
      throw new NotFoundError('Workflow');
    }

    const updated = await this.workflowRepository.updateById(
      workflowId,
      projectId,
      data,
    );

    if (!updated) {
      throw new NotFoundError('Workflow');
    }

    logger.info(
      { workflowId, projectId, userId },
      'Workflow updated',
    );

    return updated;
  }

  async delete(
    workflowId: string,
    projectId: string,
    userId: string,
  ): Promise<void> {
    // Verify project ownership
    await this.projectService.getById(projectId, userId);

    const deleted = await this.workflowRepository.deleteById(
      workflowId,
      projectId,
    );

    if (!deleted) {
      throw new NotFoundError('Workflow');
    }

    logger.info(
      { workflowId, projectId, userId },
      'Workflow deleted',
    );
  }

  // Template methods

  async saveAsTemplate(
    userId: string,
    data: CreateTemplateDto,
  ): Promise<IWorkflowDocument> {
    const sourceWorkflow = await this.workflowRepository.findById(
      data.workflowId,
    );

    if (!sourceWorkflow) {
      throw new NotFoundError('Workflow');
    }

    if (sourceWorkflow.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this workflow');
    }

    const template = await this.workflowRepository.createTemplate(
      userId,
      data.name,
      data.description,
      sourceWorkflow.nodes,
      sourceWorkflow.edges,
    );

    logger.info(
      { templateId: template._id, sourceWorkflowId: data.workflowId, userId },
      'Workflow saved as template',
    );

    return template;
  }

  async listTemplates(
    query: ListWorkflowsQuery,
  ): Promise<PaginatedResult<IWorkflowDocument>> {
    return this.workflowRepository.listTemplates(query);
  }

  async cloneTemplate(
    templateId: string,
    userId: string,
    data: CloneTemplateDto,
  ): Promise<IWorkflowDocument> {
    // Verify target project ownership
    await this.projectService.getById(data.projectId, userId);

    const template = await this.workflowRepository.findTemplateById(templateId);

    if (!template) {
      throw new NotFoundError('Template');
    }

    const cloned = await this.workflowRepository.create(
      data.projectId,
      userId,
      {
        name: data.name ?? `${template.name} (copy)`,
        description: template.description,
        nodes: template.nodes,
        edges: template.edges,
      },
    );

    logger.info(
      {
        clonedWorkflowId: cloned._id,
        templateId,
        projectId: data.projectId,
        userId,
      },
      'Template cloned into project',
    );

    return cloned;
  }
}
