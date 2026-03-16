import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { logger } from '../../common/utils/logger.js';
import { getNodeRegistry, type NodeRegistry } from '../../modules/nodes/node-registry.js';
import type { ProviderRegistry } from '../../providers/provider.registry.js';
import { WorkflowExecutionService } from '../../modules/workflows/workflow-execution.service.js';
import { ExecutionContext } from '../../engine/execution.context.js';
import {
  QUEUES,
  WORKER_CONFIG,
  RETRY_CONFIG,
  type TextAnalysisJobData,
  type JobResult,
} from '../queue.types.js';
import type { QueueManager } from '../queue.manager.js';
import { socketManager } from '../../realtime/socket.manager.js';
import { SERVER_EVENTS } from '../../realtime/socket.events.js';
import { validateRequiredInputs } from '../worker-utils.js';

export function createTextAnalysisWorker(
  connection: ConnectionOptions,
  providerRegistry: ProviderRegistry,
  _queueManager: QueueManager,
): Worker<TextAnalysisJobData, JobResult> {
  const executionService = new WorkflowExecutionService();
  const nodeRegistry = getNodeRegistry();

  const worker = new Worker<TextAnalysisJobData, JobResult>(
    QUEUES.TEXT_ANALYSIS,
    async (job: Job<TextAnalysisJobData>) => {
      const { executionId, nodeId, nodeType, workflowId, projectId, userId } = job.data;

      logger.info(
        { executionId, nodeId, nodeType, jobId: job.id },
        'Text analysis job started',
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

        // Gather upstream inputs from nodeOutputs
        const snapshotNode = execution.workflowSnapshot.nodes.find(
          (n) => n.id === nodeId,
        );
        const config = snapshotNode?.config ?? {};
        const providerConfig = snapshotNode?.providerConfig;

        // Build input from upstream node outputs using edge connections
        const input = await buildNodeInput(execution, nodeId, ctx, nodeRegistry);

        // Validate all required inputs are present
        validateRequiredInputs(handler, input, nodeType);

        // Inject provider into context for handler use
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
          'Text analysis job failed',
        );

        await ctx.updateNodeState(nodeId, {
          status: 'failed',
          error: message,
          completedAt: new Date(),
          attempts: (job.attemptsMade ?? 0) + 1,
        });
        ctx.emitProgress('node:failed', { nodeId, nodeType, error: message });

        // If all retries exhausted, fail the execution
        if ((job.attemptsMade ?? 0) + 1 >= (job.opts?.attempts ?? RETRY_CONFIG.textAnalysis.attempts)) {
          await executionService.setError(executionId, nodeId, message, job.attemptsMade ?? 0);
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: WORKER_CONFIG[QUEUES.TEXT_ANALYSIS].concurrency,
      autorun: true,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err },
      'Text analysis worker job failed',
    );

    if (job) {
      const maxAttempts = job.opts?.attempts ?? RETRY_CONFIG.textAnalysis.attempts;
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
    logger.error({ err }, 'Text analysis worker error');
  });

  logger.info('Text analysis worker started');

  return worker;
}

async function buildNodeInput(
  execution: Awaited<ReturnType<WorkflowExecutionService['findById']>>,
  nodeId: string,
  _ctx: ExecutionContext,
  nodeRegistry: NodeRegistry,
): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {};

  // Find edges targeting this node
  const incomingEdges = execution.workflowSnapshot.edges.filter(
    (e) => e.targetNodeId === nodeId,
  );

  // Track connected source nodes
  const connectedSourceNodeIds = new Set<string>();

  // Standard edge mapping
  for (const edge of incomingEdges) {
    connectedSourceNodeIds.add(edge.sourceNodeId);
    const upstreamOutput = execution.nodeOutputs.get(edge.sourceNodeId);
    if (upstreamOutput && upstreamOutput[edge.sourcePort] !== undefined) {
      input[edge.targetPort] = upstreamOutput[edge.sourcePort];
    }
  }

  // Auto-include: For connected upstream nodes, include any output
  // that matches a target input port name (if not already set)
  const targetNode = execution.workflowSnapshot.nodes.find(
    (n) => n.id === nodeId,
  );
  if (targetNode && nodeRegistry.hasHandler(targetNode.type)) {
    const portSchema = nodeRegistry.getPortSchema(targetNode.type);
    const inputPortIds = portSchema.inputs.map((p) => p.id);

    for (const sourceNodeId of connectedSourceNodeIds) {
      const upstreamOutput = execution.nodeOutputs.get(sourceNodeId);
      if (upstreamOutput) {
        for (const portId of inputPortIds) {
          // Auto-fill if not already set and upstream has matching output
          if (input[portId] === undefined && upstreamOutput[portId] !== undefined) {
            input[portId] = upstreamOutput[portId];
          }
        }
      }
    }
  }

  return input;
}
