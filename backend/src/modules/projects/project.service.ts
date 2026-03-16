import { ForbiddenError, NotFoundError } from '../../common/errors/index.js';
import { logger } from '../../common/utils/logger.js';
import type { ProjectRepository } from './project.repository.js';
import type {
  IProjectDocument,
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsQuery,
  PaginatedResult,
} from './project.types.js';

export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async create(
    userId: string,
    data: CreateProjectDto,
  ): Promise<IProjectDocument> {
    const project = await this.projectRepository.create(userId, data);
    logger.info({ projectId: project._id, userId }, 'Project created');
    return project;
  }

  async getById(
    projectId: string,
    userId: string,
  ): Promise<IProjectDocument> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (project.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this project');
    }

    return project;
  }

  async list(
    userId: string,
    query: ListProjectsQuery,
  ): Promise<PaginatedResult<IProjectDocument>> {
    return this.projectRepository.listByUserId(userId, query);
  }

  async update(
    projectId: string,
    userId: string,
    data: UpdateProjectDto,
  ): Promise<IProjectDocument> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (project.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this project');
    }

    const updated = await this.projectRepository.updateById(
      projectId,
      userId,
      data,
    );

    if (!updated) {
      throw new NotFoundError('Project');
    }

    logger.info({ projectId, userId }, 'Project updated');
    return updated;
  }

  async archive(
    projectId: string,
    userId: string,
  ): Promise<IProjectDocument> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (project.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this project');
    }

    const archived = await this.projectRepository.archive(projectId, userId);

    if (!archived) {
      throw new NotFoundError('Project');
    }

    logger.info({ projectId, userId }, 'Project archived');
    return archived;
  }
}
