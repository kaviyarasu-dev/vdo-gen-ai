import type { FlowJob as BullMQFlowJob } from 'bullmq';
import { logger } from '../../common/utils/logger.js';
import type { QueueManager } from '../queue.manager.js';
import {
  QUEUES,
  NODE_TYPE_TO_QUEUE,
  RETRY_CONFIG,
  type BaseJobData,
} from '../queue.types.js';
import type {
  IWorkflowNode,
  IWorkflowEdge,
} from '../../engine/engine.types.js';
import type { NodeType } from '../../modules/nodes/node.types.js';

export interface FlowProducerOptions {
  executionId: string;
  workflowId: string;
  projectId: string;
  userId: string;
}

export class WorkflowFlowProducer {
  constructor(private readonly queueManager: QueueManager) {}

  /**
   * Creates the initial BullMQ flow tree from the workflow DAG.
   * The flow is built in REVERSE: output node = root, inputs = deepest children.
   * Stops at scene-splitter (fan-out boundary) — downstream dynamically created later.
   */
  async createInitialFlow(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
    options: FlowProducerOptions,
  ): Promise<void> {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const incomingEdges = new Map<string, string[]>();
    for (const node of nodes) {
      incomingEdges.set(node.id, []);
    }
    for (const edge of edges) {
      incomingEdges.get(edge.targetNodeId)!.push(edge.sourceNodeId);
    }

    // Find terminal node (no outgoing edges)
    const outgoingCount = new Map<string, number>();
    for (const node of nodes) {
      outgoingCount.set(node.id, 0);
    }
    for (const edge of edges) {
      outgoingCount.set(
        edge.sourceNodeId,
        (outgoingCount.get(edge.sourceNodeId) ?? 0) + 1,
      );
    }

    const terminalNode = nodes.find(
      (n) => (outgoingCount.get(n.id) ?? 0) === 0,
    );

    if (!terminalNode) {
      throw new Error('No terminal node found in workflow');
    }

    // Check if workflow has a fan-out (scene-splitter) node
    const hasFanOut = nodes.some((n) => n.type === 'scene-splitter');

    if (hasFanOut) {
      // Build partial flow: only up to and including scene-splitter
      // The rest (image-generator -> video-generator -> video-combiner -> output)
      // will be created dynamically by the scene-splitter worker
      const preFlowNodes = this.getPreFanOutNodes(nodes, edges);

      // Find the "terminal" of the pre-flow (scene-splitter itself)
      const sceneSplitter = nodes.find((n) => n.type === 'scene-splitter')!;

      const flowTree = this.buildFlowTree(
        sceneSplitter.id,
        nodeMap,
        incomingEdges,
        new Set(),
        options,
        preFlowNodes,
      );

      const flowProducer = this.queueManager.getFlowProducer();
      await flowProducer.add(flowTree);

      logger.info(
        {
          executionId: options.executionId,
          rootNode: sceneSplitter.id,
          nodeCount: preFlowNodes.size,
        },
        'Initial pre-fan-out flow created',
      );
    } else {
      // No fan-out: build the entire flow at once
      const flowTree = this.buildFlowTree(
        terminalNode.id,
        nodeMap,
        incomingEdges,
        new Set(),
        options,
      );

      const flowProducer = this.queueManager.getFlowProducer();
      await flowProducer.add(flowTree);

      logger.info(
        {
          executionId: options.executionId,
          rootNode: terminalNode.id,
          nodeCount: nodes.length,
        },
        'Full workflow flow created',
      );
    }
  }

  /**
   * Creates the dynamic fan-out flow after scene-splitter produces N scenes.
   * Each scene gets: image-generator -> frame-composer -> video-generator
   * All converge into video-combiner -> output
   */
  async createFanOutFlow(
    options: FlowProducerOptions,
    sceneCount: number,
    nodes: IWorkflowNode[],
    _edges: IWorkflowEdge[],
  ): Promise<void> {
    // Find video-combiner, output node types from the snapshot
    const outputNode = nodes.find((n) => n.type === 'output');
    const combinerNode = nodes.find((n) => n.type === 'video-combiner');
    const imageGenNode = nodes.find((n) => n.type === 'image-generator');
    const frameComposerNode = nodes.find((n) => n.type === 'frame-composer');
    const videoGenNode = nodes.find((n) => n.type === 'video-generator');

    const childFlows: BullMQFlowJob[] = [];

    for (let i = 0; i < sceneCount; i++) {
      // image-generator (leaf of this sub-chain)
      const imgJobData: BaseJobData = {
        executionId: options.executionId,
        nodeId: `imggen-scene-${i}`,
        nodeType: 'image-generator',
        workflowId: options.workflowId,
        projectId: options.projectId,
        userId: options.userId,
      };

      const imageJob: BullMQFlowJob = {
        name: `image-generator:scene-${i}`,
        queueName: QUEUES.IMAGE_GENERATION,
        data: { ...imgJobData, providerSlug: imageGenNode?.providerConfig?.provider ?? '', sceneIndex: i },
        opts: {
          jobId: `${options.executionId}__imggen-scene-${i}`,
          attempts: RETRY_CONFIG.imageGeneration.attempts,
          backoff: RETRY_CONFIG.imageGeneration.backoff,
        },
      };

      // frame-composer depends on image-generator
      if (frameComposerNode) {
        const frameJobData: BaseJobData = {
          executionId: options.executionId,
          nodeId: `framecomp-scene-${i}`,
          nodeType: 'frame-composer',
          workflowId: options.workflowId,
          projectId: options.projectId,
          userId: options.userId,
        };

        const frameJob: BullMQFlowJob = {
          name: `frame-composer:scene-${i}`,
          queueName: QUEUES.IMAGE_GENERATION,
          data: { ...frameJobData, sceneIndex: i },
          opts: {
            jobId: `${options.executionId}__framecomp-scene-${i}`,
            attempts: RETRY_CONFIG.imageGeneration.attempts,
            backoff: RETRY_CONFIG.imageGeneration.backoff,
          },
          children: [imageJob],
        };

        // video-generator depends on frame-composer
        const vidJobData: BaseJobData = {
          executionId: options.executionId,
          nodeId: `vidgen-scene-${i}`,
          nodeType: 'video-generator',
          workflowId: options.workflowId,
          projectId: options.projectId,
          userId: options.userId,
        };

        const videoJob: BullMQFlowJob = {
          name: `video-generator:scene-${i}`,
          queueName: QUEUES.VIDEO_GENERATION,
          data: { ...vidJobData, providerSlug: videoGenNode?.providerConfig?.provider ?? '', sceneIndex: i },
          opts: {
            jobId: `${options.executionId}__vidgen-scene-${i}`,
            attempts: RETRY_CONFIG.videoGeneration.attempts,
            backoff: RETRY_CONFIG.videoGeneration.backoff,
          },
          children: [frameJob],
        };

        childFlows.push(videoJob);
      } else {
        // No frame-composer: video-generator depends directly on image-generator
        const vidJobData: BaseJobData = {
          executionId: options.executionId,
          nodeId: `vidgen-scene-${i}`,
          nodeType: 'video-generator',
          workflowId: options.workflowId,
          projectId: options.projectId,
          userId: options.userId,
        };

        const videoJob: BullMQFlowJob = {
          name: `video-generator:scene-${i}`,
          queueName: QUEUES.VIDEO_GENERATION,
          data: { ...vidJobData, providerSlug: videoGenNode?.providerConfig?.provider ?? '', sceneIndex: i },
          opts: {
            jobId: `${options.executionId}__vidgen-scene-${i}`,
            attempts: RETRY_CONFIG.videoGeneration.attempts,
            backoff: RETRY_CONFIG.videoGeneration.backoff,
          },
          children: [imageJob],
        };

        childFlows.push(videoJob);
      }
    }

    // video-combiner waits for all scene video jobs
    const combinerJobData: BaseJobData = {
      executionId: options.executionId,
      nodeId: combinerNode?.id ?? 'video-combiner',
      nodeType: 'video-combiner',
      workflowId: options.workflowId,
      projectId: options.projectId,
      userId: options.userId,
    };

    const combinerFlow: BullMQFlowJob = {
      name: `video-combiner:${combinerNode?.id ?? 'combiner'}`,
      queueName: QUEUES.VIDEO_PROCESSING,
      data: { ...combinerJobData, sceneCount },
      opts: {
        jobId: `${options.executionId}__${combinerNode?.id ?? 'video-combiner'}`,
        attempts: RETRY_CONFIG.videoProcessing.attempts,
        backoff: RETRY_CONFIG.videoProcessing.backoff,
      },
      children: childFlows,
    };

    // If there's an output node after combiner, wrap it
    if (outputNode) {
      const outputJobData: BaseJobData = {
        executionId: options.executionId,
        nodeId: outputNode.id,
        nodeType: 'output',
        workflowId: options.workflowId,
        projectId: options.projectId,
        userId: options.userId,
      };

      const outputFlow: BullMQFlowJob = {
        name: `output:${outputNode.id}`,
        queueName: QUEUES.WORKFLOW_ORCHESTRATION,
        data: outputJobData,
        opts: {
          jobId: `${options.executionId}__${outputNode.id}`,
        },
        children: [combinerFlow],
      };

      const flowProducer = this.queueManager.getFlowProducer();
      await flowProducer.add(outputFlow);
    } else {
      const flowProducer = this.queueManager.getFlowProducer();
      await flowProducer.add(combinerFlow);
    }

    logger.info(
      {
        executionId: options.executionId,
        sceneCount,
      },
      'Fan-out flow created for scenes',
    );
  }

  private buildFlowTree(
    nodeId: string,
    nodeMap: Map<string, IWorkflowNode>,
    incomingEdges: Map<string, string[]>,
    visited: Set<string>,
    options: FlowProducerOptions,
    allowedNodes?: Set<string>,
  ): BullMQFlowJob {
    visited.add(nodeId);
    const node = nodeMap.get(nodeId)!;
    const sources = (incomingEdges.get(nodeId) ?? []).filter(
      (id) => !visited.has(id) && (!allowedNodes || allowedNodes.has(id)),
    );

    const children: BullMQFlowJob[] = sources.map((sourceId) =>
      this.buildFlowTree(
        sourceId,
        nodeMap,
        incomingEdges,
        visited,
        options,
        allowedNodes,
      ),
    );

    const queueName = NODE_TYPE_TO_QUEUE[node.type];
    const retryConfig = this.getRetryConfig(node.type);

    const job: BullMQFlowJob = {
      name: `${node.type}:${nodeId}`,
      queueName,
      data: {
        executionId: options.executionId,
        nodeId,
        nodeType: node.type,
        workflowId: options.workflowId,
        projectId: options.projectId,
        userId: options.userId,
        ...(node.providerConfig?.provider
          ? { providerSlug: node.providerConfig.provider, model: node.providerConfig.model }
          : {}),
      },
      opts: {
        jobId: `${options.executionId}__${nodeId}`,
        ...(retryConfig ?? {}),
      },
    };

    if (children.length > 0) {
      job.children = children;
    }

    return job;
  }

  /**
   * Identify all nodes before the fan-out boundary (scene-splitter inclusive).
   */
  private getPreFanOutNodes(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
  ): Set<string> {
    const sceneSplitter = nodes.find((n) => n.type === 'scene-splitter');
    if (!sceneSplitter) return new Set(nodes.map((n) => n.id));

    // BFS backwards from scene-splitter
    const result = new Set<string>();
    const queue = [sceneSplitter.id];
    result.add(sceneSplitter.id);

    const incomingEdges = new Map<string, string[]>();
    for (const node of nodes) {
      incomingEdges.set(node.id, []);
    }
    for (const edge of edges) {
      incomingEdges.get(edge.targetNodeId)!.push(edge.sourceNodeId);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const sourceId of incomingEdges.get(current) ?? []) {
        if (!result.has(sourceId)) {
          result.add(sourceId);
          queue.push(sourceId);
        }
      }
    }

    return result;
  }

  private getRetryConfig(
    nodeType: NodeType,
  ): { attempts: number; backoff: { type: 'exponential' | 'fixed'; delay: number } } | undefined {
    switch (nodeType) {
      case 'script-analyzer':
      case 'character-extractor':
      case 'scene-splitter':
        return RETRY_CONFIG.textAnalysis;
      case 'image-generator':
      case 'frame-composer':
        return RETRY_CONFIG.imageGeneration;
      case 'video-generator':
        return RETRY_CONFIG.videoGeneration;
      case 'video-combiner':
        return RETRY_CONFIG.videoProcessing;
      default:
        return undefined;
    }
  }
}
