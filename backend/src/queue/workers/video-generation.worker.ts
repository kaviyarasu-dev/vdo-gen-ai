import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { logger } from '../../common/utils/logger.js';
import { getNodeRegistry } from '../../modules/nodes/node-registry.js';
import type { ProviderRegistry } from '../../providers/provider.registry.js';
import { WorkflowExecutionService } from '../../modules/workflows/workflow-execution.service.js';
import { ExecutionContext } from '../../engine/execution.context.js';
import {
  QUEUES,
  WORKER_CONFIG,
  RETRY_CONFIG,
  type VideoGenerationJobData,
  type JobResult,
} from '../queue.types.js';
import { socketManager } from '../../realtime/socket.manager.js';
import { SERVER_EVENTS } from '../../realtime/socket.events.js';
import { validateRequiredInputs } from '../worker-utils.js';

export function createVideoGenerationWorker(
  connection: ConnectionOptions,
  providerRegistry: ProviderRegistry,
): Worker<VideoGenerationJobData, JobResult> {
  const executionService = new WorkflowExecutionService();
  const nodeRegistry = getNodeRegistry();

  const worker = new Worker<VideoGenerationJobData, JobResult>(
    QUEUES.VIDEO_GENERATION,
    async (job: Job<VideoGenerationJobData>) => {
      const { executionId, nodeId, nodeType, workflowId, projectId, userId } = job.data;

      logger.info(
        { executionId, nodeId, nodeType, jobId: job.id, sceneIndex: job.data.sceneIndex },
        'Video generation job started',
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
        if ('setProviderRegistry' in handler) {
          (handler as { setProviderRegistry(r: ProviderRegistry): void }).setProviderRegistry(providerRegistry);
        }
        const execution = await executionService.findById(executionId);

        const snapshotNode = execution.workflowSnapshot.nodes.find(
          (n) => n.id === nodeId,
        );
        const config = snapshotNode?.config ?? {};
        const providerConfig = snapshotNode?.providerConfig;

        const input = buildNodeInput(execution, nodeId);

        // Validate all required inputs are present
        validateRequiredInputs(handler, input, nodeType);

        const execContext = {
          executionId,
          workflowId,
          projectId,
          userId,
          nodeId,
          providerConfig: providerConfig ?? {
            provider: job.data.providerSlug,
            model: job.data.model,
          },
        };

        const output = await handler.execute(input, config, execContext);
        const outputRecord = output as Record<string, unknown>;

        await ctx.saveNodeOutput(nodeId, outputRecord);
        await ctx.markNodeStatus(nodeId, 'completed');
        await ctx.incrementCompletedNodes(nodeId);
        ctx.emitProgress('node:completed', { nodeId, nodeType, output: outputRecord });

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
          'Video generation job failed',
        );

        await ctx.updateNodeState(nodeId, {
          status: 'failed',
          error: message,
          completedAt: new Date(),
          attempts: (job.attemptsMade ?? 0) + 1,
        });
        ctx.emitProgress('node:failed', { nodeId, nodeType, error: message });

        if ((job.attemptsMade ?? 0) + 1 >= (job.opts?.attempts ?? RETRY_CONFIG.videoGeneration.attempts)) {
          await executionService.setError(executionId, nodeId, message, job.attemptsMade ?? 0);
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: WORKER_CONFIG[QUEUES.VIDEO_GENERATION].concurrency,
      autorun: true,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Video generation worker job failed');

    if (job) {
      const maxAttempts = job.opts?.attempts ?? RETRY_CONFIG.videoGeneration.attempts;
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
    logger.error({ err }, 'Video generation worker error');
  });

  logger.info('Video generation worker started');

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
