import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { logger } from '../../common/utils/logger.js';
import { getNodeRegistry } from '../../modules/nodes/node-registry.js';
import { WorkflowExecutionService } from '../../modules/workflows/workflow-execution.service.js';
import { ExecutionContext } from '../../engine/execution.context.js';
import {
  QUEUES,
  WORKER_CONFIG,
  RETRY_CONFIG,
  type VideoProcessingJobData,
  type JobResult,
} from '../queue.types.js';
import { socketManager } from '../../realtime/socket.manager.js';
import { SERVER_EVENTS } from '../../realtime/socket.events.js';

export function createVideoCombineWorker(
  connection: ConnectionOptions,
): Worker<VideoProcessingJobData, JobResult> {
  const executionService = new WorkflowExecutionService();
  const nodeRegistry = getNodeRegistry();

  const worker = new Worker<VideoProcessingJobData, JobResult>(
    QUEUES.VIDEO_PROCESSING,
    async (job: Job<VideoProcessingJobData>) => {
      const { executionId, nodeId, nodeType, workflowId, projectId, userId } = job.data;

      logger.info(
        { executionId, nodeId, nodeType, jobId: job.id, sceneCount: job.data.sceneCount },
        'Video combine job started',
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

        // For video-combiner: also gather child job results (dynamically spawned scenes)
        if (nodeType === 'video-combiner') {
          const videos: string[] = (input.videos as string[] | undefined) ?? [];

          // Gather video outputs from scene-indexed nodes
          const sceneCount = job.data.sceneCount ?? 0;
          for (let i = 0; i < sceneCount; i++) {
            const sceneVideoOutput = execution.nodeOutputs.get(`vidgen-scene-${i}`);
            if (sceneVideoOutput?.video) {
              videos.push(sceneVideoOutput.video as string);
            }
          }

          input.videos = videos;
        }

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
          'Video combine job failed',
        );

        await ctx.updateNodeState(nodeId, {
          status: 'failed',
          error: message,
          completedAt: new Date(),
          attempts: (job.attemptsMade ?? 0) + 1,
        });
        ctx.emitProgress('node:failed', { nodeId, nodeType, error: message });

        if ((job.attemptsMade ?? 0) + 1 >= (job.opts?.attempts ?? RETRY_CONFIG.videoProcessing.attempts)) {
          await executionService.setError(executionId, nodeId, message, job.attemptsMade ?? 0);
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: WORKER_CONFIG[QUEUES.VIDEO_PROCESSING].concurrency,
      autorun: true,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Video combine worker job failed');

    if (job) {
      const maxAttempts = job.opts?.attempts ?? RETRY_CONFIG.videoProcessing.attempts;
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
    logger.error({ err }, 'Video combine worker error');
  });

  logger.info('Video combine worker started');

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
