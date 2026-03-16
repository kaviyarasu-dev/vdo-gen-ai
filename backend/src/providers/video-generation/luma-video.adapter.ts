import LumaAI from 'lumaai';
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

const SLUG = 'luma';
const DEFAULT_MODEL = 'ray-2';
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

interface LumaGeneration {
  id: string;
  state: string;
  assets?: {
    video?: string;
  };
  failure_reason?: string;
}

export class LumaVideoAdapter implements IVideoGenerationProvider {
  readonly slug = SLUG;
  readonly displayName = 'Luma';
  readonly category: ProviderCategory = 'video-generation';

  private client: LumaAI;

  constructor(apiKey: string, _webhookSecret?: string) {
    this.client = new LumaAI({ authToken: apiKey });
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const testClient = new LumaAI({ authToken: apiKey });
      // Attempt a lightweight API call to validate credentials
      await testClient.generations.get('test-nonexistent').catch((err: { status?: number }) => {
        // 404 means credentials are valid, the generation just doesn't exist
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
        id: 'ray-2',
        name: 'Ray 2',
        description: 'Latest generation model with exceptional motion and physics',
        capabilities: ['image-to-video', 'text-to-video'],
        maxResolution: { width: 1920, height: 1080 },
        maxDuration: 10,
      },
      {
        id: 'dream-machine-v1',
        name: 'Dream Machine V1',
        description: 'Original Dream Machine model with creative video synthesis',
        capabilities: ['image-to-video', 'text-to-video'],
        maxResolution: { width: 1920, height: 1080 },
        maxDuration: 5,
      },
    ];
  }

  isWebhookBased(): boolean {
    return true;
  }

  getWebhookSignatureHeader(): string {
    return 'x-luma-signature';
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
      const createParams: Record<string, unknown> = {
        model,
        prompt: input.prompt,
        keyframes: {
          frame0: {
            type: 'image',
            url: input.startFrameUrl,
          },
        },
        duration: input.duration,
        ...input.params,
      };

      if (input.endFrameUrl) {
        (createParams['keyframes'] as Record<string, unknown>)['frame1'] = {
          type: 'image',
          url: input.endFrameUrl,
        };
      }

      if (input.aspectRatio) {
        createParams['aspect_ratio'] = input.aspectRatio;
      }

      if (input.callbackUrl) {
        createParams['callback_url'] = input.callbackUrl;
      }

      const generation = await this.client.generations.create(
        createParams as unknown as Parameters<typeof this.client.generations.create>[0],
      ) as unknown as LumaGeneration;

      return {
        externalId: generation.id,
        status: generation.state === 'dreaming' ? 'processing' : 'queued',
        estimatedWaitMs: 120_000,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async checkStatus(externalId: string): Promise<VideoGenerationStatus> {
    try {
      const generation = await this.client.generations.get(
        externalId,
      ) as unknown as LumaGeneration;

      return {
        status: mapLumaStatus(generation.state),
        error: generation.failure_reason,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async getResult(externalId: string): Promise<VideoGenerationResult> {
    try {
      const generation = await this.client.generations.get(
        externalId,
      ) as unknown as LumaGeneration;

      if (generation.state === 'failed') {
        return {
          status: 'failed',
          externalId,
          error: generation.failure_reason ?? 'Video generation failed',
        };
      }

      if (generation.state !== 'completed') {
        throw new ProviderError(
          `Generation ${externalId} is not completed (state: ${generation.state})`,
          SLUG,
          { retryable: true },
        );
      }

      const videoUrl = generation.assets?.video;
      if (!videoUrl) {
        return {
          status: 'failed',
          externalId,
          error: 'No output URL in completed generation',
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
    const message = errObj.error?.message ?? errObj.message ?? 'Unknown Luma error';

    if (status === 429) {
      return new ProviderRateLimitError(SLUG, 60_000, { originalMessage: message });
    }

    if (status === 408 || message.includes('timeout')) {
      return new ProviderTimeoutError(SLUG, 120_000, { originalMessage: message });
    }

    logger.error({ err: error }, 'Luma API error');

    return new ProviderError(message, SLUG, {
      retryable: status !== undefined && status >= 500,
      statusCode: status === 401 ? 401 : 502,
      details: { originalStatus: status },
    });
  }
}

function mapLumaStatus(state: string): VideoGenerationStatus['status'] {
  switch (state) {
    case 'queued':
      return 'queued';
    case 'dreaming':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
