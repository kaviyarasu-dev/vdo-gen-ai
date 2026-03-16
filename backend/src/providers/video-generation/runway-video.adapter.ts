import RunwayML from '@runwayml/sdk';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../../common/utils/logger.js';
import {
  ProviderError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '../provider.errors.js';
import type { ProviderCategory, ProviderModel } from '../provider.types.js';
import type {
  VideoGenerationInput,
  VideoSubmissionResult,
  VideoGenerationStatus,
  VideoGenerationResult,
  PollOptions,
} from '../provider.types.js';
import type { IVideoGenerationProvider } from './video-generation.interface.js';

const SLUG = 'runway';
const DEFAULT_MODEL = 'gen4_turbo';
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

interface RunwayTask {
  id: string;
  status: string;
  progress?: number;
  failure?: string;
  failureCode?: string;
  output?: string[];
  estimatedTimeToStartSeconds?: number;
}

export class RunwayVideoAdapter implements IVideoGenerationProvider {
  readonly slug = SLUG;
  readonly displayName = 'Runway';
  readonly category: ProviderCategory = 'video-generation';

  private client: RunwayML;

  constructor(apiKey: string, _webhookSecret?: string) {
    this.client = new RunwayML({ apiKey });
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const testClient = new RunwayML({ apiKey });
      // Attempt a lightweight API call to validate credentials
      await testClient.tasks.retrieve('test-nonexistent').catch((err: { status?: number }) => {
        // 404 means credentials are valid, the task just doesn't exist
        if (err.status === 404) return;
        throw err;
      });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ProviderModel[]> {
    return [
      {
        id: 'gen4_turbo',
        name: 'Gen-4 Turbo',
        description: 'Latest generation model with fast turnaround',
        capabilities: ['image-to-video', 'text-to-video'],
        maxResolution: { width: 1920, height: 1080 },
        maxDuration: 10,
      },
      {
        id: 'gen3a_turbo',
        name: 'Gen-3 Alpha Turbo',
        description: 'Fast, high-quality video generation',
        capabilities: ['image-to-video', 'text-to-video'],
        maxResolution: { width: 1920, height: 1080 },
        maxDuration: 10,
      },
    ];
  }

  isWebhookBased(): boolean {
    return true;
  }

  getWebhookSignatureHeader(): string {
    return 'x-runway-signature';
  }

  verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async submit(input: VideoGenerationInput): Promise<VideoSubmissionResult> {
    const model = input.model || DEFAULT_MODEL;

    try {
      const taskInput: Record<string, unknown> = {
        model,
        promptImage: input.startFrameUrl,
        promptText: input.prompt,
        duration: input.duration,
        ...input.params,
      };

      if (input.endFrameUrl) {
        taskInput['lastFrame'] = { uri: input.endFrameUrl, type: 'lastFrame' as const };
      }

      if (input.aspectRatio) {
        taskInput['ratio'] = input.aspectRatio;
      }

      if (input.callbackUrl) {
        taskInput['callbackUrl'] = input.callbackUrl;
      }

      const task = await this.client.imageToVideo.create(
        taskInput as unknown as Parameters<typeof this.client.imageToVideo.create>[0],
      ) as unknown as RunwayTask;

      return {
        externalId: task.id,
        status: task.status === 'RUNNING' ? 'processing' : 'queued',
        estimatedWaitMs: (task.estimatedTimeToStartSeconds ?? 60) * 1000,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async checkStatus(externalId: string): Promise<VideoGenerationStatus> {
    try {
      const task = await this.client.tasks.retrieve(externalId) as unknown as RunwayTask;

      return {
        status: mapRunwayStatus(task.status),
        progress: task.progress,
        error: task.failure ?? task.failureCode,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async getResult(externalId: string): Promise<VideoGenerationResult> {
    try {
      const task = await this.client.tasks.retrieve(externalId) as unknown as RunwayTask;

      if (task.status === 'FAILED') {
        return {
          status: 'failed',
          externalId,
          error: task.failure ?? task.failureCode ?? 'Video generation failed',
        };
      }

      if (task.status !== 'SUCCEEDED') {
        throw new ProviderError(
          `Task ${externalId} is not completed (status: ${task.status})`,
          SLUG,
          { retryable: true },
        );
      }

      const videoUrl = task.output?.[0];
      if (!videoUrl) {
        return {
          status: 'failed',
          externalId,
          error: 'No output URL in completed task',
        };
      }

      return {
        status: 'completed',
        externalId,
        videoUrl,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw this.mapError(error);
    }
  }

  async waitForResult(externalId: string, options?: PollOptions): Promise<VideoGenerationResult> {
    const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.checkStatus(externalId);

      options?.onProgress?.(status);

      if (status.status === 'completed') {
        return this.getResult(externalId);
      }

      if (status.status === 'failed') {
        return {
          status: 'failed',
          externalId,
          error: status.error ?? 'Video generation failed',
        };
      }

      await sleep(intervalMs);
    }

    throw new ProviderTimeoutError(SLUG, intervalMs * maxAttempts, {
      externalId,
      maxAttempts,
    });
  }

  private mapError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    const errObj = error as { status?: number; message?: string; error?: { message?: string } };
    const status = errObj.status;
    const message = errObj.error?.message ?? errObj.message ?? 'Unknown Runway error';

    if (status === 429) {
      return new ProviderRateLimitError(SLUG, 60_000, { originalMessage: message });
    }

    if (status === 408 || message.includes('timeout')) {
      return new ProviderTimeoutError(SLUG, 120_000, { originalMessage: message });
    }

    logger.error({ err: error }, 'Runway API error');

    return new ProviderError(message, SLUG, {
      retryable: status !== undefined && status >= 500,
      statusCode: status === 401 ? 401 : 502,
      details: { originalStatus: status },
    });
  }
}

function mapRunwayStatus(status: string): VideoGenerationStatus['status'] {
  switch (status) {
    case 'PENDING':
      return 'queued';
    case 'RUNNING':
    case 'THROTTLED':
      return 'processing';
    case 'SUCCEEDED':
      return 'completed';
    case 'FAILED':
    case 'CANCELLED':
      return 'failed';
    default:
      return 'queued';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
