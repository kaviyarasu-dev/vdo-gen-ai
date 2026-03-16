import type { FilterQuery } from 'mongoose';

import ProjectModel from './project.model.js';
import type {
  IProjectDocument,
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsQuery,
  PaginatedResult,
} from './project.types.js';

export class ProjectRepository {
  async create(
    userId: string,
    data: CreateProjectDto,
  ): Promise<IProjectDocument> {
    const project = new ProjectModel({
      userId,
      name: data.name,
      description: data.description,
      settings: data.settings,
    });
    return project.save();
  }

  async findById(projectId: string): Promise<IProjectDocument | null> {
    return ProjectModel.findById(projectId).exec();
  }

  async findByIdAndUserId(
    projectId: string,
    userId: string,
  ): Promise<IProjectDocument | null> {
    return ProjectModel.findOne({
      _id: projectId,
      userId,
      status: { $ne: 'archived' },
    }).exec();
  }

  async listByUserId(
    userId: string,
    query: ListProjectsQuery,
  ): Promise<PaginatedResult<IProjectDocument>> {
    const filter: FilterQuery<IProjectDocument> = { userId };

    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = { $ne: 'archived' };
    }

    const skip = (query.page - 1) * query.limit;

    const [projects, total] = await Promise.all([
      ProjectModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      ProjectModel.countDocuments(filter).exec(),
    ]);

    return {
      data: projects,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async updateById(
    projectId: string,
    userId: string,
    data: UpdateProjectDto,
  ): Promise<IProjectDocument | null> {
    const updateFields: Record<string, unknown> = {};

    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.status !== undefined) updateFields.status = data.status;

    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        if (value !== undefined) {
          updateFields[`settings.${key}`] = value;
        }
      }
    }

    return ProjectModel.findOneAndUpdate(
      { _id: projectId, userId },
      { $set: updateFields },
      { new: true },
    ).exec();
  }

  async archive(
    projectId: string,
    userId: string,
  ): Promise<IProjectDocument | null> {
    return ProjectModel.findOneAndUpdate(
      { _id: projectId, userId },
      { $set: { status: 'archived' } },
      { new: true },
    ).exec();
  }
}
