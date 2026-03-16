import type { FilterQuery } from 'mongoose';

import WorkflowModel from './workflow.model.js';
import type {
  IWorkflowDocument,
  CreateWorkflowDto,
  UpdateWorkflowDto,
  ListWorkflowsQuery,
} from './workflow.types.js';
import type { PaginatedResult } from '../projects/project.types.js';

export class WorkflowRepository {
  async create(
    projectId: string,
    userId: string,
    data: CreateWorkflowDto,
  ): Promise<IWorkflowDocument> {
    const workflow = new WorkflowModel({
      projectId,
      userId,
      name: data.name,
      description: data.description,
      nodes: data.nodes,
      edges: data.edges,
    });
    return workflow.save();
  }

  async findById(workflowId: string): Promise<IWorkflowDocument | null> {
    return WorkflowModel.findById(workflowId).exec();
  }

  async findByIdAndProject(
    workflowId: string,
    projectId: string,
  ): Promise<IWorkflowDocument | null> {
    return WorkflowModel.findOne({
      _id: workflowId,
      projectId,
      isTemplate: false,
    }).exec();
  }

  async listByProject(
    projectId: string,
    query: ListWorkflowsQuery,
  ): Promise<PaginatedResult<IWorkflowDocument>> {
    const filter: FilterQuery<IWorkflowDocument> = {
      projectId,
      isTemplate: false,
    };

    const skip = (query.page - 1) * query.limit;

    const [workflows, total] = await Promise.all([
      WorkflowModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      WorkflowModel.countDocuments(filter).exec(),
    ]);

    return {
      data: workflows,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async updateById(
    workflowId: string,
    projectId: string,
    data: UpdateWorkflowDto,
  ): Promise<IWorkflowDocument | null> {
    const updateFields: Record<string, unknown> = {};

    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.nodes !== undefined) updateFields.nodes = data.nodes;
    if (data.edges !== undefined) updateFields.edges = data.edges;

    // Increment version on structural changes
    const shouldBumpVersion = data.nodes !== undefined || data.edges !== undefined;

    return WorkflowModel.findOneAndUpdate(
      { _id: workflowId, projectId, isTemplate: false },
      {
        $set: updateFields,
        ...(shouldBumpVersion ? { $inc: { version: 1 } } : {}),
      },
      { new: true },
    ).exec();
  }

  async deleteById(
    workflowId: string,
    projectId: string,
  ): Promise<IWorkflowDocument | null> {
    return WorkflowModel.findOneAndDelete({
      _id: workflowId,
      projectId,
      isTemplate: false,
    }).exec();
  }

  // Template methods
  async createTemplate(
    userId: string,
    name: string,
    description: string | undefined,
    nodes: IWorkflowDocument['nodes'],
    edges: IWorkflowDocument['edges'],
  ): Promise<IWorkflowDocument> {
    const template = new WorkflowModel({
      userId,
      name,
      description,
      nodes,
      edges,
      isTemplate: true,
    });
    return template.save();
  }

  async listTemplates(
    query: ListWorkflowsQuery,
  ): Promise<PaginatedResult<IWorkflowDocument>> {
    const filter: FilterQuery<IWorkflowDocument> = { isTemplate: true };
    const skip = (query.page - 1) * query.limit;

    const [templates, total] = await Promise.all([
      WorkflowModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      WorkflowModel.countDocuments(filter).exec(),
    ]);

    return {
      data: templates,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findTemplateById(
    templateId: string,
  ): Promise<IWorkflowDocument | null> {
    return WorkflowModel.findOne({
      _id: templateId,
      isTemplate: true,
    }).exec();
  }
}
