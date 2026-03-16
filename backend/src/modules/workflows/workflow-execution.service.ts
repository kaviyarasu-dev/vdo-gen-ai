import { NotFoundError, ForbiddenError } from '../../common/errors/index.js';
import { logger } from '../../common/utils/logger.js';
import WorkflowExecutionModel from './workflow-execution.model.js';
import type {
  IWorkflowDocument,
  IWorkflowExecutionDocument,
  INodeExecutionState,
  ExecutionStatus,
  NodeExecutionStatus,
} from './workflow.types.js';

export class WorkflowExecutionService {
  async create(
    workflow: IWorkflowDocument,
    userId: string,
  ): Promise<IWorkflowExecutionDocument> {
    // Build initial node states (all pending)
    const nodeStates = new Map<string, INodeExecutionState>();
    for (const node of workflow.nodes) {
      nodeStates.set(node.id, {
        nodeId: node.id,
        status: 'pending',
        attempts: 0,
      });
    }

    const execution = new WorkflowExecutionModel({
      workflowId: workflow._id,
      projectId: workflow.projectId,
      userId,
      status: 'pending',
      workflowSnapshot: {
        nodes: workflow.nodes,
        edges: workflow.edges,
      },
      nodeStates,
      nodeOutputs: new Map(),
      progress: {
        totalNodes: workflow.nodes.length,
        completedNodes: 0,
        percentage: 0,
      },
    });

    const saved = await execution.save();

    logger.info(
      {
        executionId: saved._id,
        workflowId: workflow._id,
        userId,
        totalNodes: workflow.nodes.length,
      },
      'Workflow execution created',
    );

    return saved;
  }

  async findById(
    executionId: string,
  ): Promise<IWorkflowExecutionDocument> {
    const execution = await WorkflowExecutionModel.findById(executionId).exec();

    if (!execution) {
      throw new NotFoundError('Workflow execution');
    }

    return execution;
  }

  async findByIdAndUser(
    executionId: string,
    userId: string,
  ): Promise<IWorkflowExecutionDocument> {
    const execution = await this.findById(executionId);

    if (execution.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this execution');
    }

    return execution;
  }

  async updateStatus(
    executionId: string,
    status: ExecutionStatus,
  ): Promise<IWorkflowExecutionDocument> {
    const updateFields: Record<string, unknown> = { status };

    if (status === 'running') {
      updateFields.startedAt = new Date();
    }

    if (
      status === 'completed' ||
      status === 'failed' ||
      status === 'cancelled'
    ) {
      updateFields.completedAt = new Date();
    }

    const updated = await WorkflowExecutionModel.findByIdAndUpdate(
      executionId,
      { $set: updateFields },
      { new: true },
    ).exec();

    if (!updated) {
      throw new NotFoundError('Workflow execution');
    }

    logger.info({ executionId, status }, 'Execution status updated');

    return updated;
  }

  async updateNodeState(
    executionId: string,
    nodeId: string,
    state: Partial<INodeExecutionState>,
  ): Promise<IWorkflowExecutionDocument> {
    const updateFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(state)) {
      if (value !== undefined) {
        updateFields[`nodeStates.${nodeId}.${key}`] = value;
      }
    }

    const updated = await WorkflowExecutionModel.findByIdAndUpdate(
      executionId,
      { $set: updateFields },
      { new: true },
    ).exec();

    if (!updated) {
      throw new NotFoundError('Workflow execution');
    }

    return updated;
  }

  async updateNodeStatus(
    executionId: string,
    nodeId: string,
    status: NodeExecutionStatus,
  ): Promise<IWorkflowExecutionDocument> {
    const stateUpdate: Partial<INodeExecutionState> = { status };

    if (status === 'running') {
      stateUpdate.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      stateUpdate.completedAt = new Date();
    }

    return this.updateNodeState(executionId, nodeId, stateUpdate);
  }

  async setNodeOutput(
    executionId: string,
    nodeId: string,
    output: Record<string, unknown>,
  ): Promise<IWorkflowExecutionDocument> {
    const updated = await WorkflowExecutionModel.findByIdAndUpdate(
      executionId,
      { $set: { [`nodeOutputs.${nodeId}`]: output } },
      { new: true },
    ).exec();

    if (!updated) {
      throw new NotFoundError('Workflow execution');
    }

    return updated;
  }

  async updateProgress(
    executionId: string,
    completedNodes: number,
    totalNodes: number,
    currentNodeId?: string,
  ): Promise<IWorkflowExecutionDocument> {
    const percentage =
      totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    const updated = await WorkflowExecutionModel.findByIdAndUpdate(
      executionId,
      {
        $set: {
          'progress.completedNodes': completedNodes,
          'progress.totalNodes': totalNodes,
          'progress.currentNodeId': currentNodeId,
          'progress.percentage': percentage,
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new NotFoundError('Workflow execution');
    }

    return updated;
  }

  async setError(
    executionId: string,
    nodeId: string,
    message: string,
    retryCount: number,
  ): Promise<IWorkflowExecutionDocument> {
    const updated = await WorkflowExecutionModel.findByIdAndUpdate(
      executionId,
      {
        $set: {
          error: { nodeId, message, retryCount },
          status: 'failed',
          completedAt: new Date(),
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new NotFoundError('Workflow execution');
    }

    logger.error(
      { executionId, nodeId, message, retryCount },
      'Execution failed',
    );

    return updated;
  }

  async listByProject(
    projectId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: IWorkflowExecutionDocument[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      WorkflowExecutionModel.find({ projectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      WorkflowExecutionModel.countDocuments({ projectId }).exec(),
    ]);

    return {
      data: executions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
