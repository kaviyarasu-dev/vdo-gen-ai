import type { NodeType } from '../modules/nodes/node.types.js';

export const QUEUES = {
  TEXT_ANALYSIS: 'vdo.text-analysis',
  IMAGE_GENERATION: 'vdo.image-generation',
  VIDEO_GENERATION: 'vdo.video-generation',
  VIDEO_PROCESSING: 'vdo.video-processing',
  WORKFLOW_ORCHESTRATION: 'vdo.orchestration',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const WORKER_CONFIG: Record<QueueName, { concurrency: number }> = {
  [QUEUES.TEXT_ANALYSIS]: { concurrency: 5 },
  [QUEUES.IMAGE_GENERATION]: { concurrency: 3 },
  [QUEUES.VIDEO_GENERATION]: { concurrency: 2 },
  [QUEUES.VIDEO_PROCESSING]: { concurrency: 2 },
  [QUEUES.WORKFLOW_ORCHESTRATION]: { concurrency: 10 },
};

export const RETRY_CONFIG = {
  textAnalysis: { attempts: 3, backoff: { type: 'exponential' as const, delay: 2000 } },
  imageGeneration: { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } },
  videoGeneration: { attempts: 2, backoff: { type: 'exponential' as const, delay: 10000 } },
  videoProcessing: { attempts: 2, backoff: { type: 'fixed' as const, delay: 5000 } },
} as const;

export const NODE_TYPE_TO_QUEUE: Record<NodeType, QueueName> = {
  'script-input': QUEUES.WORKFLOW_ORCHESTRATION,
  'script-analyzer': QUEUES.TEXT_ANALYSIS,
  'character-extractor': QUEUES.TEXT_ANALYSIS,
  'scene-splitter': QUEUES.TEXT_ANALYSIS,
  'image-generator': QUEUES.IMAGE_GENERATION,
  'frame-composer': QUEUES.IMAGE_GENERATION,
  'video-generator': QUEUES.VIDEO_GENERATION,
  'video-combiner': QUEUES.VIDEO_PROCESSING,
  'output': QUEUES.WORKFLOW_ORCHESTRATION,
};

export interface BaseJobData {
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  workflowId: string;
  projectId: string;
  userId: string;
}

export interface TextAnalysisJobData extends BaseJobData {
  nodeType: 'script-analyzer' | 'character-extractor' | 'scene-splitter';
  providerSlug: string;
  model?: string;
}

export interface ImageGenerationJobData extends BaseJobData {
  nodeType: 'image-generator' | 'frame-composer';
  providerSlug?: string;
  model?: string;
  sceneIndex?: number;
}

export interface VideoGenerationJobData extends BaseJobData {
  nodeType: 'video-generator';
  providerSlug: string;
  model?: string;
  sceneIndex?: number;
}

export interface VideoProcessingJobData extends BaseJobData {
  nodeType: 'video-combiner';
  sceneCount?: number;
}

export interface OrchestrationJobData extends BaseJobData {
  nodeType: 'script-input' | 'output';
}

export type JobData =
  | TextAnalysisJobData
  | ImageGenerationJobData
  | VideoGenerationJobData
  | VideoProcessingJobData
  | OrchestrationJobData;

export interface JobResult {
  nodeId: string;
  output: Record<string, unknown>;
  completedAt: string;
}
