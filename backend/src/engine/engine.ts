import { logger } from '../common/utils/logger.js';
import { ValidationError, NotFoundError } from '../common/errors/index.js';
import { GraphResolver } from './graph.resolver.js';
import { WorkflowFlowProducer } from '../queue/flows/workflow-flow.producer.js';
import { WorkflowExecutionService } from '../modules/workflows/workflow-execution.service.js';
import type { QueueManager } from '../queue/queue.manager.js';
import { QUEUES, NODE_TYPE_TO_QUEUE } from '../queue/queue.types.js';
import type { BaseJobData } from '../queue/queue.types.js';
import type { ExecutionStatus, IWorkflowExecution } from '../modules/workflows/workflow.types.js';
import { socketManager } from '../realtime/socket.manager.js';
import { SERVER_EVENTS } from '../realtime/socket.events.js';

export class WorkflowEngine {
  private readonly graphResolver = new GraphResolver();
  private readonly flowProducer: WorkflowFlowProducer;
  private readonly executionService: WorkflowExecutionService;

  constructor(private readonly queueManager: QueueManager) {
    this.flowProducer = new WorkflowFlowProducer(queueManager);
    this.executionService = new WorkflowExecutionService();
  }

  async start(executionId: string): Promise<void> {
    const execution = await this.executionService.findById(executionId);

    const { nodes, edges } = execution.workflowSnapshot;

    // Validate graph
    const validation = this.graphResolver.validate(nodes, edges);
    if (!validation.isValid) {
      await this.executionService.setError(
        executionId,
        '',
        `Invalid workflow graph: ${validation.errors.join(', ')}`,
        0,
      );
      throw new ValidationError(
        `Invalid workflow graph: ${validation.errors.join('; ')}`,
        { graphErrors: validation.errors },
      );
    }

    // Mark execution as running
    await this.executionService.updateStatus(executionId, 'running');

    // Mark all nodes as queued
    for (const node of nodes) {
      await this.executionService.updateNodeStatus(
        executionId,
        node.id,
        'queued',
      );
    }

    // Create BullMQ flow
    await this.flowProducer.createInitialFlow(nodes, edges, {
      executionId,
      workflowId: execution.workflowId.toString(),
      projectId: execution.projectId.toString(),
      userId: execution.userId.toString(),
    });

    const startPayload = {
      executionId,
      workflowId: execution.workflowId.toString(),
      timestamp: new Date().toISOString(),
    };
    socketManager.emitToExecution(executionId, SERVER_EVENTS.EXECUTION_STARTED, startPayload);
    socketManager.emitToProject(execution.projectId.toString(), SERVER_EVENTS.EXECUTION_STARTED, startPayload);
    socketManager.emitToUser(execution.userId.toString(), SERVER_EVENTS.EXECUTION_STARTED, startPayload);

    logger.info(
      { executionId, nodeCount: nodes.length },
      'Workflow execution started',
    );
  }

  async pause(executionId: string): Promise<void> {
    const execution = await this.executionService.findById(executionId);

    if (execution.status !== 'running') {
      throw new ValidationError(`Cannot pause execution in "${execution.status}" state`);
    }

    await this.executionService.updateStatus(executionId, 'paused');

    // Pause all queues
    for (const queueName of Object.values(QUEUES)) {
      await this.queueManager.pauseQueue(queueName);
    }

    const pausePayload = { executionId, timestamp: new Date().toISOString() };
    socketManager.emitToExecution(executionId, SERVER_EVENTS.EXECUTION_PAUSED, pausePayload);
    socketManager.emitToUser(execution.userId.toString(), SERVER_EVENTS.EXECUTION_PAUSED, pausePayload);

    logger.info({ executionId }, 'Workflow execution paused');
  }

  async resume(executionId: string): Promise<void> {
    const execution = await this.executionService.findById(executionId);

    if (execution.status !== 'paused') {
      throw new ValidationError(`Cannot resume execution in "${execution.status}" state`);
    }

    await this.executionService.updateStatus(executionId, 'running');

    // Resume all queues
    for (const queueName of Object.values(QUEUES)) {
      await this.queueManager.resumeQueue(queueName);
    }

    const resumePayload = { executionId, timestamp: new Date().toISOString() };
    socketManager.emitToExecution(executionId, SERVER_EVENTS.EXECUTION_STARTED, resumePayload);
    socketManager.emitToUser(execution.userId.toString(), SERVER_EVENTS.EXECUTION_STARTED, resumePayload);

    logger.info({ executionId }, 'Workflow execution resumed');
  }

  async cancel(executionId: string): Promise<void> {
    const execution = await this.executionService.findById(executionId);

    const cancellableStatuses: ExecutionStatus[] = ['pending', 'running', 'paused', 'failed'];
    if (!cancellableStatuses.includes(execution.status)) {
      throw new ValidationError(`Cannot cancel execution in "${execution.status}" state`);
    }

    // Skip job cleanup for already-terminal states (failed) — jobs are already done
    if (execution.status !== 'failed') {
      // Remove all pending jobs for this execution from queues
      for (const queueName of Object.values(QUEUES)) {
        const queue = this.queueManager.getQueue(queueName);
        const waiting = await queue.getJobs(['waiting', 'delayed', 'prioritized']);
        for (const job of waiting) {
          if (job.data?.executionId === executionId) {
            await job.remove();
          }
        }
      }

      // Mark pending/queued/running nodes as skipped
      for (const [, nodeState] of execution.nodeStates) {
        if (['pending', 'queued', 'running'].includes(nodeState.status)) {
          await this.executionService.updateNodeStatus(
            executionId,
            nodeState.nodeId,
            'skipped',
          );
        }
      }
    }

    await this.executionService.updateStatus(executionId, 'cancelled');

    const cancelPayload = { executionId, timestamp: new Date().toISOString() };
    socketManager.emitToExecution(executionId, SERVER_EVENTS.EXECUTION_CANCELLED, cancelPayload);
    socketManager.emitToUser(execution.userId.toString(), SERVER_EVENTS.EXECUTION_CANCELLED, cancelPayload);

    logger.info({ executionId }, 'Workflow execution cancelled');
  }

  async retry(executionId: string): Promise<string> {
    const execution = await this.executionService.findById(executionId);

    if (execution.status !== 'failed') {
      throw new ValidationError(`Cannot retry execution in "${execution.status}" state`);
    }

    // Create a new execution from the same workflow snapshot
    const newExecution = await this.executionService.create(
      {
        _id: execution.workflowId,
        projectId: execution.projectId,
        userId: execution.userId,
        nodes: execution.workflowSnapshot.nodes,
        edges: execution.workflowSnapshot.edges,
      } as Parameters<WorkflowExecutionService['create']>[0],
      execution.userId.toString(),
    );

    const newExecutionId = newExecution._id.toString();

    // Start the new execution
    await this.start(newExecutionId);

    logger.info(
      { originalExecutionId: executionId, newExecutionId },
      'Workflow execution retried',
    );

    return newExecutionId;
  }

  async overrideNode(
    executionId: string,
    nodeId: string,
    assetUrl: string,
  ): Promise<IWorkflowExecution> {
    const execution = await this.executionService.findById(executionId);

    // Only allow override on failed or paused executions
    const allowedStatuses: ExecutionStatus[] = ['failed', 'paused'];
    if (!allowedStatuses.includes(execution.status)) {
      throw new ValidationError(
        `Cannot override node in "${execution.status}" execution — must be "failed" or "paused"`,
      );
    }

    // Validate the node exists and is in a failed state
    const nodeState = execution.nodeStates.get(nodeId);
    if (!nodeState) {
      throw new NotFoundError(`Node "${nodeId}" in execution`);
    }

    if (nodeState.status !== 'failed') {
      throw new ValidationError(
        `Cannot override node in "${nodeState.status}" state — must be "failed"`,
      );
    }

    // Set the override output on the node
    await this.executionService.setNodeOutput(executionId, nodeId, {
      overridden: true,
      assetUrl,
    });

    // Mark node as completed
    await this.executionService.updateNodeStatus(executionId, nodeId, 'completed');

    // Increment completed nodes in progress
    const completedNodes = execution.progress.completedNodes + 1;
    const totalNodes = execution.progress.totalNodes;
    await this.executionService.updateProgress(
      executionId,
      completedNodes,
      totalNodes,
      nodeId,
    );

    // Resume execution: mark as running
    await this.executionService.updateStatus(executionId, 'running');

    // Find and re-queue downstream nodes
    await this.requeueDownstreamNodes(execution, nodeId);

    // Emit socket events for node completion
    const nodeCompletedPayload = {
      executionId,
      nodeId,
      status: 'completed' as const,
      overridden: true,
      assetUrl,
      timestamp: new Date().toISOString(),
    };
    socketManager.emitToExecution(executionId, SERVER_EVENTS.NODE_COMPLETED, nodeCompletedPayload);
    socketManager.emitToUser(
      execution.userId.toString(),
      SERVER_EVENTS.NODE_COMPLETED,
      nodeCompletedPayload,
    );

    // Emit execution resumed event
    const resumePayload = { executionId, timestamp: new Date().toISOString() };
    socketManager.emitToExecution(executionId, SERVER_EVENTS.EXECUTION_STARTED, resumePayload);
    socketManager.emitToUser(execution.userId.toString(), SERVER_EVENTS.EXECUTION_STARTED, resumePayload);

    logger.info(
      { executionId, nodeId, assetUrl },
      'Node overridden with external asset — execution resumed',
    );

    return this.executionService.findById(executionId);
  }

  async retryNode(
    executionId: string,
    nodeId: string,
  ): Promise<IWorkflowExecution> {
    const execution = await this.executionService.findById(executionId);

    // Only allow retry on failed or paused executions
    const allowedStatuses: ExecutionStatus[] = ['failed', 'paused'];
    if (!allowedStatuses.includes(execution.status)) {
      throw new ValidationError(
        `Cannot retry node in "${execution.status}" execution — must be "failed" or "paused"`,
      );
    }

    // Validate the node exists and is in a failed state
    const nodeState = execution.nodeStates.get(nodeId);
    if (!nodeState) {
      throw new NotFoundError(`Node "${nodeId}" in execution`);
    }

    if (nodeState.status !== 'failed') {
      throw new ValidationError(
        `Cannot retry node in "${nodeState.status}" state — must be "failed"`,
      );
    }

    // Reset node state to pending with incremented attempts
    await this.executionService.updateNodeState(executionId, nodeId, {
      status: 'pending',
      attempts: nodeState.attempts + 1,
      error: undefined,
      completedAt: undefined,
    });

    // Find the node type from the workflow snapshot
    const workflowNode = execution.workflowSnapshot.nodes.find(
      (n) => n.id === nodeId,
    );
    if (!workflowNode) {
      throw new NotFoundError(`Node "${nodeId}" in workflow snapshot`);
    }

    // Re-queue the single node job in BullMQ
    const queueName = NODE_TYPE_TO_QUEUE[workflowNode.type];
    const queue = this.queueManager.getQueue(queueName);
    const jobData: BaseJobData = {
      executionId,
      nodeId,
      nodeType: workflowNode.type,
      workflowId: execution.workflowId.toString(),
      projectId: execution.projectId.toString(),
      userId: execution.userId.toString(),
    };

    await queue.add(`${workflowNode.type}:${nodeId}`, jobData, {
      jobId: `${executionId}__${nodeId}__retry-${nodeState.attempts + 1}`,
    });

    // Mark execution as running if it was failed
    if (execution.status === 'failed') {
      await this.executionService.updateStatus(executionId, 'running');
    }

    // Emit socket events
    const retryPayload = {
      executionId,
      nodeId,
      attempt: nodeState.attempts + 1,
      timestamp: new Date().toISOString(),
    };
    socketManager.emitToExecution(executionId, SERVER_EVENTS.NODE_RETRYING, retryPayload);
    socketManager.emitToUser(
      execution.userId.toString(),
      SERVER_EVENTS.NODE_RETRYING,
      retryPayload,
    );

    if (execution.status === 'failed') {
      const resumePayload = { executionId, timestamp: new Date().toISOString() };
      socketManager.emitToExecution(executionId, SERVER_EVENTS.EXECUTION_STARTED, resumePayload);
      socketManager.emitToUser(execution.userId.toString(), SERVER_EVENTS.EXECUTION_STARTED, resumePayload);
    }

    logger.info(
      { executionId, nodeId, attempt: nodeState.attempts + 1 },
      'Single node retried — job re-queued',
    );

    return this.executionService.findById(executionId);
  }

  getFlowProducer(): WorkflowFlowProducer {
    return this.flowProducer;
  }

  // ── Private helpers ───────────────────────────────────────────────

  /**
   * Find downstream nodes connected to the given node and re-queue them.
   */
  private async requeueDownstreamNodes(
    execution: IWorkflowExecution,
    sourceNodeId: string,
  ): Promise<void> {
    const { nodes, edges } = execution.workflowSnapshot;
    const executionId = execution._id.toString();

    // Build outgoing adjacency: source -> targets
    const outgoing = new Map<string, string[]>();
    for (const node of nodes) {
      outgoing.set(node.id, []);
    }
    for (const edge of edges) {
      outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const downstreamIds = outgoing.get(sourceNodeId) ?? [];

    for (const targetNodeId of downstreamIds) {
      const targetNode = nodeMap.get(targetNodeId);
      if (!targetNode) continue;

      const targetState = execution.nodeStates.get(targetNodeId);
      // Only re-queue nodes that are pending or failed (skip completed/running)
      if (targetState && !['pending', 'failed', 'skipped'].includes(targetState.status)) {
        continue;
      }

      // Mark as queued
      await this.executionService.updateNodeStatus(executionId, targetNodeId, 'queued');

      // Add to the appropriate BullMQ queue
      const queueName = NODE_TYPE_TO_QUEUE[targetNode.type];
      const queue = this.queueManager.getQueue(queueName);
      const jobData: BaseJobData = {
        executionId,
        nodeId: targetNodeId,
        nodeType: targetNode.type,
        workflowId: execution.workflowId.toString(),
        projectId: execution.projectId.toString(),
        userId: execution.userId.toString(),
      };

      await queue.add(`${targetNode.type}:${targetNodeId}`, jobData, {
        jobId: `${executionId}__${targetNodeId}__resume-${Date.now()}`,
      });

      // Emit queued event
      const queuedPayload = {
        executionId,
        nodeId: targetNodeId,
        timestamp: new Date().toISOString(),
      };
      socketManager.emitToExecution(executionId, SERVER_EVENTS.NODE_QUEUED, queuedPayload);

      logger.info(
        { executionId, nodeId: targetNodeId },
        'Downstream node re-queued after override',
      );
    }
  }
}
