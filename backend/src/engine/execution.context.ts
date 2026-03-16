import { logger } from '../common/utils/logger.js';
import { WorkflowExecutionService } from '../modules/workflows/workflow-execution.service.js';
import type { INodeExecutionState, NodeExecutionStatus } from '../modules/workflows/workflow.types.js';
import { socketManager } from '../realtime/socket.manager.js';
import { SERVER_EVENTS } from '../realtime/socket.events.js';

export class ExecutionContext {
  private readonly executionService: WorkflowExecutionService;
  private readonly executionId: string;
  private readonly workflowId: string;
  private readonly projectId: string;
  private readonly userId: string;

  constructor(params: {
    executionService: WorkflowExecutionService;
    executionId: string;
    workflowId: string;
    projectId: string;
    userId: string;
  }) {
    this.executionService = params.executionService;
    this.executionId = params.executionId;
    this.workflowId = params.workflowId;
    this.projectId = params.projectId;
    this.userId = params.userId;
  }

  getExecutionId(): string {
    return this.executionId;
  }

  getWorkflowId(): string {
    return this.workflowId;
  }

  getProjectId(): string {
    return this.projectId;
  }

  getUserId(): string {
    return this.userId;
  }

  async getNodeOutput<T>(nodeId: string): Promise<T> {
    const execution = await this.executionService.findById(this.executionId);
    const output = execution.nodeOutputs.get(nodeId);

    if (!output) {
      throw new Error(
        `No output found for node "${nodeId}" in execution "${this.executionId}"`,
      );
    }

    return output as T;
  }

  async saveNodeOutput(nodeId: string, output: Record<string, unknown>): Promise<void> {
    await this.executionService.setNodeOutput(this.executionId, nodeId, output);

    logger.debug(
      { executionId: this.executionId, nodeId },
      'Node output saved',
    );
  }

  async updateNodeState(
    nodeId: string,
    state: Partial<INodeExecutionState>,
  ): Promise<void> {
    await this.executionService.updateNodeState(
      this.executionId,
      nodeId,
      state,
    );
  }

  async markNodeStatus(nodeId: string, status: NodeExecutionStatus): Promise<void> {
    await this.executionService.updateNodeStatus(
      this.executionId,
      nodeId,
      status,
    );
  }

  async incrementCompletedNodes(currentNodeId: string): Promise<void> {
    const execution = await this.executionService.findById(this.executionId);
    const completedNodes = execution.progress.completedNodes + 1;
    const totalNodes = execution.progress.totalNodes;
    const percentage = totalNodes > 0
      ? Math.round((completedNodes / totalNodes) * 100)
      : 0;

    await this.executionService.updateProgress(
      this.executionId,
      completedNodes,
      totalNodes,
      currentNodeId,
    );

    // Emit execution-level progress update
    this.emitProgress(SERVER_EVENTS.EXECUTION_PROGRESS, {
      progress: { totalNodes, completedNodes, percentage },
    });
  }

  emitProgress(event: string, data: unknown): void {
    const payload = {
      executionId: this.executionId,
      workflowId: this.workflowId,
      timestamp: new Date().toISOString(),
      ...(data as Record<string, unknown>),
    };

    // Broadcast to execution room (clients watching this specific run)
    socketManager.emitToExecution(this.executionId, event, payload);

    // Also broadcast to the project room for dashboard-level updates
    socketManager.emitToProject(this.projectId, event, payload);

    // And to the user room for global notifications
    socketManager.emitToUser(this.userId, event, payload);

    logger.debug(
      { executionId: this.executionId, event },
      'Progress event emitted via Socket.io',
    );
  }
}
