import { fal } from '@fal-ai/client';

import { logger } from '../../common/utils/logger.js';
import {
  ProviderError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '../provider.errors.js';
import type { ProviderCategory, ProviderModel } from '../provider.types.js';
import type {
  ImageGenerationInput,
  ImageGenerationResult,
  GenerationStatus,
} from '../provider.types.js';
import type { IImageGenerationProvider } from './image-generation.interface.js';

const SLUG = 'fal';
const DEFAULT_MODEL = 'fal-ai/flux/dev';

interface FalImage {
  url: string;
  width: number;
  height: number;
  content_type?: string;
}

interface FalResult {
  images?: FalImage[];
  request_id?: string;
}

interface FalQueueStatus {
  status: string;
  request_id?: string;
  response_url?: string;
}

export class FalImageAdapter implements IImageGenerationProvider {
  readonly slug = SLUG;
  readonly displayName = 'FAL AI';
  readonly category: ProviderCategory = 'image-generation';

  constructor(apiKey: string) {
    fal.config({ credentials: apiKey });
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      fal.config({ credentials: apiKey });
      // Attempt a minimal request to validate
      await fal.queue.submit(DEFAULT_MODEL, {
        input: { prompt: 'test', image_size: { width: 64, height: 64 } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ProviderModel[]> {
    return [
      {
        id: 'fal-ai/flux/dev',
        name: 'FLUX Dev',
        description: 'High-quality image generation model',
        capabilities: ['text-to-image'],
        maxResolution: { width: 2048, height: 2048 },
      },
      {
        id: 'fal-ai/flux-pro/v1.1',
        name: 'FLUX 1.1 Pro',
        description: 'Production-grade image generation with superior quality',
        capabilities: ['text-to-image'],
        maxResolution: { width: 2048, height: 2048 },
      },
      {
        id: 'fal-ai/flux-realism',
        name: 'FLUX Realism',
        description: 'Photorealistic image generation',
        capabilities: ['text-to-image'],
        maxResolution: { width: 2048, height: 2048 },
      },
    ];
  }

  isWebhookBased(): boolean {
    return false;
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const model = input.model || DEFAULT_MODEL;

    try {
      const falInput: Record<string, unknown> = {
        prompt: input.prompt,
        image_size: { width: input.width, height: input.height },
        num_images: input.numImages ?? 1,
        ...input.params,
      };

      if (input.negativePrompt) {
        falInput['negative_prompt'] = input.negativePrompt;
      }

      if (input.seed !== undefined) {
        falInput['seed'] = input.seed;
      }

      if (input.referenceImages?.length) {
        falInput['image_url'] = input.referenceImages[0].url;
      }

      const result = await fal.subscribe(model, { input: falInput }) as FalResult;

      if (!result.images?.length) {
        return {
          status: 'failed',
          error: 'No images returned from FAL AI',
        };
      }

      return {
        status: 'completed',
        externalId: result.request_id,
        images: result.images.map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
          contentType: img.content_type ?? 'image/png',
        })),
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async checkStatus(externalId: string): Promise<GenerationStatus> {
    try {
      const status = await fal.queue.status(DEFAULT_MODEL, {
        requestId: externalId,
        logs: false,
      }) as FalQueueStatus;

      return {
        status: mapFalStatus(status.status),
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async getResult(externalId: string): Promise<ImageGenerationResult> {
    try {
      const result = await fal.queue.result(DEFAULT_MODEL, {
        requestId: externalId,
      }) as { data: FalResult };

      const data = result.data;

      if (!data.images?.length) {
        return { status: 'failed', error: 'No images in result' };
      }

      return {
        status: 'completed',
        externalId,
        images: data.images.map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
          contentType: img.content_type ?? 'image/png',
        })),
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    const errObj = error as { status?: number; message?: string; body?: unknown };
    const status = errObj.status;
    const message = errObj.message ?? 'Unknown FAL AI error';

    if (status === 429) {
      return new ProviderRateLimitError(SLUG, 60_000, { originalMessage: message });
    }

    if (status === 408 || message.includes('timeout')) {
      return new ProviderTimeoutError(SLUG, 120_000, { originalMessage: message });
    }

    logger.error({ err: error }, 'FAL AI error');

    return new ProviderError(message, SLUG, {
      retryable: status !== undefined && status >= 500,
      statusCode: status === 401 ? 401 : 502,
      details: { originalStatus: status },
    });
  }
}

function mapFalStatus(status: string): GenerationStatus['status'] {
  switch (status) {
    case 'IN_QUEUE':
      return 'queued';
    case 'IN_PROGRESS':
      return 'processing';
    case 'COMPLETED':
      return 'completed';
    default:
      return 'failed';
  }
}
