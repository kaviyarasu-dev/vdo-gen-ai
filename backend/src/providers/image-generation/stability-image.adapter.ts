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

const SLUG = 'stability';
const DEFAULT_MODEL = 'stable-diffusion-xl-1024-v1-0';
const BASE_URL = 'https://api.stability.ai';

interface StabilityArtifact {
  base64: string;
  finishReason: string;
  seed: number;
}

interface StabilityResponse {
  artifacts: StabilityArtifact[];
}

export class StabilityImageAdapter implements IImageGenerationProvider {
  readonly slug = SLUG;
  readonly displayName = 'Stability AI';
  readonly category: ProviderCategory = 'image-generation';

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/v1/user/balance`, {
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
        id: 'stable-diffusion-xl-1024-v1-0',
        name: 'SDXL 1.0',
        description: 'Stable Diffusion XL — high-resolution image generation',
        capabilities: ['text-to-image'],
        maxResolution: { width: 1024, height: 1024 },
      },
      {
        id: 'stable-diffusion-v1-6',
        name: 'SD 1.6',
        description: 'Stable Diffusion 1.6 — fast and versatile image generation',
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
      const textPrompts: { text: string; weight: number }[] = [
        { text: input.prompt, weight: 1 },
      ];

      if (input.negativePrompt) {
        textPrompts.push({ text: input.negativePrompt, weight: -1 });
      }

      const body: Record<string, unknown> = {
        text_prompts: textPrompts,
        cfg_scale: (input.params?.['cfg_scale'] as number) ?? 7,
        width: input.width,
        height: input.height,
        samples: input.numImages ?? 1,
        ...input.params,
      };

      // Ensure text_prompts is not overwritten by spread
      body['text_prompts'] = textPrompts;

      if (input.seed !== undefined) {
        body['seed'] = input.seed;
      }

      const response = await fetch(
        `${BASE_URL}/v1/generation/${model}/text-to-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw Object.assign(new Error(errorBody || `Stability API returned ${response.status}`), {
          status: response.status,
        });
      }

      const data = (await response.json()) as StabilityResponse;

      if (!data.artifacts?.length) {
        return {
          status: 'failed',
          error: 'No artifacts returned from Stability AI',
        };
      }

      return {
        status: 'completed',
        images: data.artifacts.map((artifact) => ({
          url: `data:image/png;base64,${artifact.base64}`,
          width: input.width,
          height: input.height,
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
    const message = errObj.message ?? 'Unknown Stability AI error';

    if (status === 429) {
      return new ProviderRateLimitError(SLUG, 60_000, { originalMessage: message });
    }

    if (status === 408 || message.includes('timeout')) {
      return new ProviderTimeoutError(SLUG, 120_000, { originalMessage: message });
    }

    logger.error({ err: error }, 'Stability AI error');

    return new ProviderError(message, SLUG, {
      retryable: status !== undefined && status >= 500,
      statusCode: status === 401 ? 401 : 502,
      details: { originalStatus: status },
    });
  }
}
