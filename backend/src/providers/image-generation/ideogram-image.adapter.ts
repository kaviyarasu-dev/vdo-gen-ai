import { timingSafeEqual } from 'node:crypto';

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

const SLUG = 'ideogram';
const DEFAULT_MODEL = 'ideogram-v2';
const BASE_URL = 'https://api.ideogram.ai';

interface IdeogramImage {
  url: string;
  resolution: string;
  is_image_safe: boolean;
  prompt: string;
}

interface IdeogramGenerateResponse {
  request_id: string;
  data: IdeogramImage[];
}

interface IdeogramRetrieveResponse {
  request_id: string;
  status: string;
  data?: IdeogramImage[];
  error?: string;
}

function computeAspectRatio(width: number, height: number): string {
  const ratio = width / height;

  const ASPECT_RATIOS: { label: string; value: number }[] = [
    { label: 'ASPECT_1_1', value: 1 },
    { label: 'ASPECT_16_9', value: 16 / 9 },
    { label: 'ASPECT_9_16', value: 9 / 16 },
    { label: 'ASPECT_4_3', value: 4 / 3 },
    { label: 'ASPECT_3_4', value: 3 / 4 },
    { label: 'ASPECT_3_2', value: 3 / 2 },
    { label: 'ASPECT_2_3', value: 2 / 3 },
    { label: 'ASPECT_16_10', value: 16 / 10 },
    { label: 'ASPECT_10_16', value: 10 / 16 },
  ];

  let bestMatch = ASPECT_RATIOS[0];
  let bestDistance = Infinity;

  for (const entry of ASPECT_RATIOS) {
    const distance = Math.abs(ratio - entry.value);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = entry;
    }
  }

  return bestMatch.label;
}

export class IdeogramImageAdapter implements IImageGenerationProvider {
  readonly slug = SLUG;
  readonly displayName = 'Ideogram';
  readonly category: ProviderCategory = 'image-generation';

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/manage/api/account`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ProviderModel[]> {
    return [
      {
        id: 'ideogram-v2',
        name: 'Ideogram V2',
        description: 'High-quality image generation with excellent text rendering',
        capabilities: ['text-to-image'],
        maxResolution: { width: 1024, height: 1024 },
      },
      {
        id: 'ideogram-v2-turbo',
        name: 'Ideogram V2 Turbo',
        description: 'Faster generation with the Ideogram V2 architecture',
        capabilities: ['text-to-image'],
        maxResolution: { width: 1024, height: 1024 },
      },
    ];
  }

  isWebhookBased(): boolean {
    return true;
  }

  getWebhookSignatureHeader(): string {
    return 'authorization';
  }

  verifyWebhookSignature(_payload: Buffer, signature: string, secret: string): boolean {
    // Ideogram uses Bearer token verification in the Authorization header
    const expectedToken = `Bearer ${secret}`;
    try {
      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedToken),
      );
    } catch {
      return false;
    }
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const model = input.model || DEFAULT_MODEL;

    try {
      const imageRequest: Record<string, unknown> = {
        prompt: input.prompt,
        model,
        aspect_ratio: computeAspectRatio(input.width, input.height),
        magic_prompt_option: 'AUTO',
      };

      if (input.negativePrompt) {
        imageRequest['negative_prompt'] = input.negativePrompt;
      }

      if (input.seed !== undefined) {
        imageRequest['seed'] = input.seed;
      }

      if (input.numImages) {
        imageRequest['num_images'] = input.numImages;
      }

      if (input.params) {
        Object.assign(imageRequest, input.params);
      }

      const response = await fetch(`${BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ image_request: imageRequest }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw Object.assign(new Error(errorBody || `Ideogram API returned ${response.status}`), {
          status: response.status,
        });
      }

      const data = (await response.json()) as IdeogramGenerateResponse;

      // Ideogram may return data immediately or require polling
      if (data.data?.length) {
        return {
          status: 'completed',
          externalId: data.request_id,
          images: data.data.map((img) => ({
            url: img.url,
            width: input.width,
            height: input.height,
            contentType: 'image/png',
          })),
        };
      }

      // Async — return pending with the request ID for polling
      return {
        status: 'pending',
        externalId: data.request_id,
        estimatedWaitMs: 30_000,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async checkStatus(externalId: string): Promise<GenerationStatus> {
    try {
      const response = await fetch(`${BASE_URL}/manage/retrieve/${externalId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw Object.assign(new Error(errorBody || `Ideogram status check failed: ${response.status}`), {
          status: response.status,
        });
      }

      const data = (await response.json()) as IdeogramRetrieveResponse;

      return {
        status: mapIdeogramStatus(data.status),
        error: data.error,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async getResult(externalId: string): Promise<ImageGenerationResult> {
    try {
      const response = await fetch(`${BASE_URL}/manage/retrieve/${externalId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw Object.assign(new Error(errorBody || `Ideogram result retrieval failed: ${response.status}`), {
          status: response.status,
        });
      }

      const data = (await response.json()) as IdeogramRetrieveResponse;

      if (data.status === 'FAILED' || data.status === 'failed') {
        return {
          status: 'failed',
          externalId,
          error: data.error ?? 'Image generation failed',
        };
      }

      if (!data.data?.length) {
        return {
          status: 'failed',
          externalId,
          error: 'No images in result',
        };
      }

      return {
        status: 'completed',
        externalId,
        images: data.data.map((img) => ({
          url: img.url,
          width: 1024,
          height: 1024,
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

    const errObj = error as { status?: number; message?: string };
    const status = errObj.status;
    const message = errObj.message ?? 'Unknown Ideogram error';

    if (status === 429) {
      return new ProviderRateLimitError(SLUG, 60_000, { originalMessage: message });
    }

    if (status === 408 || message.includes('timeout')) {
      return new ProviderTimeoutError(SLUG, 120_000, { originalMessage: message });
    }

    logger.error({ err: error }, 'Ideogram API error');

    return new ProviderError(message, SLUG, {
      retryable: status !== undefined && status >= 500,
      statusCode: status === 401 ? 401 : 502,
      details: { originalStatus: status },
    });
  }
}

function mapIdeogramStatus(status: string): GenerationStatus['status'] {
  switch (status.toUpperCase()) {
    case 'QUEUED':
    case 'PENDING':
      return 'queued';
    case 'PROCESSING':
    case 'IN_PROGRESS':
      return 'processing';
    case 'COMPLETED':
    case 'SUCCESS':
      return 'completed';
    case 'FAILED':
    case 'ERROR':
      return 'failed';
    default:
      return 'queued';
  }
}
