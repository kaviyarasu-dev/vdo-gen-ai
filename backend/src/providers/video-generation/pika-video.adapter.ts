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

const SLUG = 'pika';
const BASE_URL = 'https://api.pika.art/v1';
const DEFAULT_MODEL = 'pika-v2';
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

interface PikaGenerationResponse {
  id: string;
  status: string;
  video?: {
    url: string;
    duration: number;
  };
  error?: string;
}

export class PikaVideoAdapter implements IVideoGenerationProvider {
  readonly slug = SLUG;
  readonly displayName = 'Pika';
  readonly category: ProviderCategory = 'video-generation';

  private readonly apiKey: string;

  constructor(apiKey: string, _webhookSecret?: string) {
    this.apiKey = apiKey;
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/generate/test-nonexistent`, {
        method: 'GET',
        headers: this.buildHeaders(apiKey),
      });

      // 404 means credentials are valid, the resource just doesn't exist
      if (response.status === 404) return true;
      if (response.status === 401 || response.status === 403) return false;

      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ProviderModel[]> {
    return [
      {
        id: 'pika-v2',
        name: 'Pika V2',
        description: 'Latest generation model with superior motion quality',
        capabilities: ['image-to-video', 'text-to-video'],
        maxResolution: { width: 1920, height: 1080 },
        maxDuration: 10,
      },
      {
        id: 'pika-v1',
        name: 'Pika V1',
        description: 'Stable video generation with creative motion styles',
        capabilities: ['image-to-video', 'text-to-video'],
        maxResolution: { width: 1920, height: 1080 },
        maxDuration: 4,
      },
    ];
  }

  isWebhookBased(): boolean {
    return true;
  }

  getWebhookSignatureHeader(): string {
    return 'x-pika-signature';
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
      const body: Record<string, unknown> = {
        model,
        prompt: input.prompt,
        image: input.startFrameUrl,
        duration: input.duration,
        ...input.params,
      };

      if (input.aspectRatio) {
        body['aspect_ratio'] = input.aspectRatio;
      }

      if (input.callbackUrl) {
        body['callback_url'] = input.callbackUrl;
      }

      const response = await fetch(`${BASE_URL}/generate/image-to-video`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw await this.buildFetchError(response);
      }

      const generation = (await response.json()) as PikaGenerationResponse;

      return {
        externalId: generation.id,
        status: generation.status === 'processing' ? 'processing' : 'queued',
        estimatedWaitMs: 90_000,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async checkStatus(externalId: string): Promise<VideoGenerationStatus> {
    try {
      const response = await fetch(`${BASE_URL}/generate/${externalId}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw await this.buildFetchError(response);
      }

      const generation = (await response.json()) as PikaGenerationResponse;

      return {
        status: mapPikaStatus(generation.status),
        error: generation.error,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async getResult(externalId: string): Promise<VideoGenerationResult> {
    try {
      const response = await fetch(`${BASE_URL}/generate/${externalId}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw await this.buildFetchError(response);
      }

      const generation = (await response.json()) as PikaGenerationResponse;

      if (generation.status === 'failed') {
        return {
          status: 'failed',
          externalId,
          error: generation.error ?? 'Video generation failed',
        };
      }

      if (generation.status !== 'completed') {
        throw new ProviderError(
          `Generation ${externalId} is not completed (status: ${generation.status})`,
          SLUG,
          { retryable: true },
        );
      }

      if (!generation.video?.url) {
        return {
          status: 'failed',
          externalId,
          error: 'No output URL in completed generation',
        };
      }

      return {
        status: 'completed',
        externalId,
        videoUrl: generation.video.url,
        duration: generation.video.duration,
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

  private buildHeaders(apiKey?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey ?? this.apiKey}`,
    };
  }

  private async buildFetchError(response: Response): Promise<{ status: number; message: string }> {
    let message = `Pika API error (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore parse errors
    }
    return { status: response.status, message };
  }

  private mapError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    const errObj = error as { status?: number; message?: string; error?: { message?: string } };
    const status = errObj.status;
    const message = errObj.error?.message ?? errObj.message ?? 'Unknown Pika error';

    if (status === 429) {
      return new ProviderRateLimitError(SLUG, 60_000, { originalMessage: message });
    }

    if (status === 408 || message.includes('timeout')) {
      return new ProviderTimeoutError(SLUG, 120_000, { originalMessage: message });
    }

    logger.error({ err: error }, 'Pika API error');

    return new ProviderError(message, SLUG, {
      retryable: status !== undefined && status >= 500,
      statusCode: status === 401 ? 401 : 502,
      details: { originalStatus: status },
    });
  }
}

function mapPikaStatus(status: string): VideoGenerationStatus['status'] {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'processing':
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
