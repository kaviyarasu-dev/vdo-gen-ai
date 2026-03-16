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

const SLUG = 'kie';
const DEFAULT_MODEL = 'kie-v1';
const DEFAULT_BASE_URL = 'https://api.kie.ai/api/v1';

interface KieSubmitResponse {
  id: string;
  status: 'pending' | 'processing';
}

interface KieTaskImage {
  url: string;
  width: number;
  height: number;
}

interface KieTaskResponse {
  id: string;
  status: string;
  result?: { images: KieTaskImage[] };
  error?: string;
}

export class KieImageAdapter implements IImageGenerationProvider {
  readonly slug = SLUG;
  readonly displayName = 'KIE AI';
  readonly category: ProviderCategory = 'image-generation';

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? DEFAULT_BASE_URL;
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
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
        id: 'kie-v1',
        name: 'KIE V1',
        description: 'KIE AI image generation model',
        capabilities: ['text-to-image'],
        maxResolution: { width: 2048, height: 2048 },
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
    // KIE uses Bearer token verification in the Authorization header
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
      const body: Record<string, unknown> = {
        model,
        prompt: input.prompt,
        width: input.width,
        height: input.height,
        num_images: input.numImages ?? 1,
      };

      if (input.negativePrompt) {
        body['negative_prompt'] = input.negativePrompt;
      }

      if (input.seed !== undefined) {
        body['seed'] = input.seed;
      }

      if (input.params?.['callback_url']) {
        body['callback_url'] = input.params['callback_url'];
      }

      if (input.params) {
        const { callback_url: _ignored, ...restParams } = input.params;
        Object.assign(body, restParams);
      }

      // Ensure core fields are not overwritten by params spread
      body['model'] = model;
      body['prompt'] = input.prompt;

      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw Object.assign(new Error(errorBody || `KIE API returned ${response.status}`), {
          status: response.status,
        });
      }

      const data = (await response.json()) as KieSubmitResponse;

      return {
        status: 'pending',
        externalId: data.id,
        estimatedWaitMs: 30_000,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async checkStatus(externalId: string): Promise<GenerationStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks/${externalId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw Object.assign(new Error(errorBody || `KIE status check failed: ${response.status}`), {
          status: response.status,
        });
      }

      const data = (await response.json()) as KieTaskResponse;

      return {
        status: mapKieStatus(data.status),
        error: data.error,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async getResult(externalId: string): Promise<ImageGenerationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks/${externalId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw Object.assign(new Error(errorBody || `KIE result retrieval failed: ${response.status}`), {
          status: response.status,
        });
      }

      const data = (await response.json()) as KieTaskResponse;

      if (data.status === 'failed' || data.status === 'error') {
        return {
          status: 'failed',
          externalId,
          error: data.error ?? 'Image generation failed',
        };
      }

      if (!data.result?.images?.length) {
        return {
          status: 'failed',
          externalId,
          error: 'No images in result',
        };
      }

      return {
        status: 'completed',
        externalId,
        images: data.result.images.map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
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
    const message = errObj.message ?? 'Unknown KIE AI error';

    if (status === 429) {
      return new ProviderRateLimitError(SLUG, 60_000, { originalMessage: message });
    }

    if (status === 408 || message.includes('timeout')) {
      return new ProviderTimeoutError(SLUG, 120_000, { originalMessage: message });
    }

    logger.error({ err: error }, 'KIE AI error');

    return new ProviderError(message, SLUG, {
      retryable: status !== undefined && status >= 500,
      statusCode: status === 401 ? 401 : 502,
      details: { originalStatus: status },
    });
  }
}

function mapKieStatus(status: string): GenerationStatus['status'] {
  switch (status.toLowerCase()) {
    case 'queued':
    case 'pending':
      return 'queued';
    case 'processing':
    case 'running':
      return 'processing';
    case 'completed':
    case 'success':
    case 'done':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'queued';
  }
}
