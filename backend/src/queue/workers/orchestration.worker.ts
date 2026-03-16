import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { logger } from '../../common/utils/logger.js';
import { getNodeRegistry } from '../../modules/nodes/node-registry.js';
import { WorkflowExecutionService } from '../../modules/workflows/workflow-execution.service.js';
import { ExecutionContext } from '../../engine/execution.context.js';
import type { QueueManager } from '../queue.manager.js';
import {
  QUEUES,
  WORKER_CONFIG,
  type OrchestrationJobData,
  type JobResult,
} from '../queue.types.js';
import { socketManager } from '../../realtime/socket.manager.js';
import { SERVER_EVENTS } from '../../realtime/socket.events.js';

export function createOrchestrationWorker(
  connection: ConnectionOptions,
  _queueManager: QueueManager,
): Worker<OrchestrationJobData, JobResult> {
  const executionService = new WorkflowExecutionService();
  const nodeRegistry = getNodeRegistry();

  const worker = new Worker<OrchestrationJobData, JobResult>(
    QUEUES.WORKFLOW_ORCHESTRATION,
    async (job: Job<OrchestrationJobData>) => {
      const { executionId, nodeId, nodeType, workflowId, projectId, userId } = job.data;

      logger.info(
        { executionId, nodeId, nodeType, jobId: job.id },
        'Orchestration job started',
      );

      const ctx = new ExecutionContext({
        executionService,
        executionId,
        workflowId,
        projectId,
        userId,
      });

      await ctx.markNodeStatus(nodeId, 'running');
      ctx.emitProgress('node:started', { nodeId, nodeType });

      try {
        const handler = nodeRegistry.getHandler(nodeType);
        const execution = await executionService.findById(executionId);

        const snapshotNode = execution.workflowSnapshot.nodes.find(
          (n) => n.id === nodeId,
        );
        const config = snapshotNode?.config ?? {};

        const input = buildNodeInput(execution, nodeId);

        const execContext = {
          executionId,
          workflowId,
          projectId,
          userId,
          nodeId,
        };

        const output = await handler.execute(input, config, execContext);
        const outputRecord = output as Record<string, unknown>;

        await ctx.saveNodeOutput(nodeId, outputRecord);
        await ctx.markNodeStatus(nodeId, 'completed');
        await ctx.incrementCompletedNodes(nodeId);
        ctx.emitProgress('node:completed', { nodeId, nodeType, output: outputRecord });

        // If this is the output node, mark execution as completed
        if (nodeType === 'output') {
          await executionService.updateStatus(executionId, 'completed');
          ctx.emitProgress('execution:completed', { executionId });
          logger.info({ executionId }, 'Workflow execution completed');
        }

        await job.updateProgress(100);

        return {
          nodeId,
          output: outputRecord,
          completedAt: new Date().toISOString(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          { executionId, nodeId, nodeType, err: error },
          'Orchestration job failed',
        );

        await ctx.updateNodeState(nodeId, {
          status: 'failed',
          error: message,
          completedAt: new Date(),
          attempts: (job.attemptsMade ?? 0) + 1,
        });
        ctx.emitProgress('node:failed', { nodeId, nodeType, error: message });

        await executionService.setError(executionId, nodeId, message, job.attemptsMade ?? 0);

        throw error;
      }
    },
    {
      connection,
      concurrency: WORKER_CONFIG[QUEUES.WORKFLOW_ORCHESTRATION].concurrency,
      autorun: true,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Orchestration worker job failed');

    if (job) {
      const maxAttempts = job.opts?.attempts ?? 1;
      if (job.attemptsMade < maxAttempts) {
        socketManager.emitToExecution(job.data.executionId, SERVER_EVENTS.NODE_RETRYING, {
          executionId: job.data.executionId,
          nodeId: job.data.nodeId,
          nodeType: job.data.nodeType,
          attempt: job.attemptsMade,
          maxAttempts,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Orchestration worker error');
  });

  logger.info('Orchestration worker started');

  return worker;
}

function buildNodeInput(
  execution: Awaited<ReturnType<WorkflowExecutionService['findById']>>,
  nodeId: string,
): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  const incomingEdges = execution.workflowSnapshot.edges.filter(
    (e) => e.targetNodeId === nodeId,
  );

  for (const edge of incomingEdges) {
    const upstreamOutput = execution.nodeOutputs.get(edge.sourceNodeId);
    if (upstreamOutput && upstreamOutput[edge.sourcePort] !== undefined) {
      input[edge.targetPort] = upstreamOutput[edge.sourcePort];
    }
  }

  return input;
}
