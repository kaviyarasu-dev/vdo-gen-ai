import OpenAI from 'openai';

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
} from '../provider.types.js';
import type { IImageGenerationProvider } from './image-generation.interface.js';

const SLUG = 'dalle';
const DEFAULT_MODEL = 'dall-e-3';

type ValidSize = '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024';

const VALID_SIZES: { size: ValidSize; width: number; height: number }[] = [
  { size: '256x256', width: 256, height: 256 },
  { size: '512x512', width: 512, height: 512 },
  { size: '1024x1024', width: 1024, height: 1024 },
  { size: '1024x1792', width: 1024, height: 1792 },
  { size: '1792x1024', width: 1792, height: 1024 },
];

function snapToValidSize(width: number, height: number): { size: ValidSize; width: number; height: number } {
  const aspectRatio = width / height;
  let bestMatch = VALID_SIZES[2]; // default to 1024x1024
  let bestDistance = Infinity;

  for (const entry of VALID_SIZES) {
    const entryAspect = entry.width / entry.height;
    const distance = Math.abs(aspectRatio - entryAspect) + Math.abs(width * height - entry.width * entry.height) / 1_000_000;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = entry;
    }
  }

  return bestMatch;
}

export class DalleImageAdapter implements IImageGenerationProvider {
  readonly slug = SLUG;
  readonly displayName = 'DALL-E';
  readonly category: ProviderCategory = 'image-generation';

  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const testClient = new OpenAI({ apiKey });
      await testClient.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ProviderModel[]> {
    return [
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        description: 'Latest DALL-E model with improved prompt following and detail',
        capabilities: ['text-to-image'],
        maxResolution: { width: 1792, height: 1024 },
      },
      {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        description: 'Previous generation model, supports batch generation up to 10 images',
        capabilities: ['text-to-image'],
        maxResolution: { width: 1024, height: 1024 },
      },
    ];
  }

  isWebhookBased(): boolean {
    return false;
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const model = input.model || DEFAULT_MODEL;

    try {
      const snapped = snapToValidSize(input.width, input.height);
      const isDalle3 = model === 'dall-e-3';

      // DALL-E 3 only supports n=1, DALL-E 2 supports up to 10
      const numImages = isDalle3 ? 1 : Math.min(input.numImages ?? 1, 10);

      const quality = (input.params?.['quality'] as string) ?? (isDalle3 ? 'standard' : undefined);

      const params: OpenAI.Images.ImageGenerateParams = {
        model,
        prompt: input.prompt,
        size: snapped.size,
        n: numImages,
        response_format: 'url',
      };

      if (quality && isDalle3) {
        params.quality = quality as 'standard' | 'hd';
      }

      const response = await this.client.images.generate(params);

      if (!response.data?.length) {
        return {
          status: 'failed',
          error: 'No images returned from DALL-E',
        };
      }

      return {
        status: 'completed',
        images: response.data.map((image) => ({
          url: image.url ?? '',
          width: snapped.width,
          height: snapped.height,
          contentType: 'image/png',
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

    const errObj = error as { status?: number; message?: string; error?: { message?: string } };
    const status = errObj.status;
    const message = errObj.error?.message ?? errObj.message ?? 'Unknown DALL-E error';

    if (status === 429) {
      return new ProviderRateLimitError(SLUG, 60_000, { originalMessage: message });
    }

    if (status === 408 || message.includes('timeout')) {
      return new ProviderTimeoutError(SLUG, 120_000, { originalMessage: message });
    }

    logger.error({ err: error }, 'DALL-E API error');

    return new ProviderError(message, SLUG, {
      retryable: status !== undefined && status >= 500,
      statusCode: status === 401 ? 401 : 502,
      details: { originalStatus: status },
    });
  }
}
