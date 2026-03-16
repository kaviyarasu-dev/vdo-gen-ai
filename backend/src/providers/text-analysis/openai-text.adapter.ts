import OpenAI from 'openai';

import { logger } from '../../common/utils/logger.js';
import {
  ProviderError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '../provider.errors.js';
import type { ProviderCategory, ProviderModel } from '../provider.types.js';
import type {
  ScriptAnalysisInput,
  ScriptAnalysisOutput,
  CharacterExtractionInput,
  CharacterExtractionOutput,
  SceneSplitInput,
  SceneSplitOutput,
  ImagePromptInput,
  ImagePromptOutput,
} from '../provider.types.js';
import type { ITextAnalysisProvider } from './text-analysis.interface.js';

const DEFAULT_MODEL = 'gpt-4o';
const SLUG = 'openai';

export class OpenAITextAdapter implements ITextAnalysisProvider {
  readonly slug = SLUG;
  readonly displayName = 'OpenAI';
  readonly category: ProviderCategory = 'text-analysis';

  private client: OpenAI;

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
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most capable model for text analysis and structured output',
        capabilities: ['script-analysis', 'character-extraction', 'scene-splitting', 'image-prompt-generation'],
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Faster and cheaper model for simpler analysis tasks',
        capabilities: ['script-analysis', 'character-extraction', 'scene-splitting', 'image-prompt-generation'],
      },
    ];
  }

  isWebhookBased(): boolean {
    return false;
  }

  async analyzeScript(input: ScriptAnalysisInput): Promise<ScriptAnalysisOutput> {
    const model = input.model ?? DEFAULT_MODEL;

    const systemPrompt = `You are a professional script analyst. Analyze the provided script and return a structured JSON analysis.
Return ONLY valid JSON matching this exact schema:
{
  "title": "string - the title or a generated title",
  "genre": "string - primary genre",
  "tone": "string - overall tone",
  "totalScenes": "number - estimated scene count",
  "characters": [{ "name": "string", "description": "string" }],
  "themes": ["string"],
  "summary": "string - 2-3 sentence summary"
}`;

    const response = await this.chatCompletion(model, systemPrompt, input.script);
    return this.parseJsonResponse<ScriptAnalysisOutput>(response);
  }

  async extractCharacters(input: CharacterExtractionInput): Promise<CharacterExtractionOutput> {
    const model = input.model ?? DEFAULT_MODEL;

    const systemPrompt = `You are a character analyst. Extract all characters from the provided script.
Return ONLY valid JSON matching this exact schema:
{
  "characters": [{
    "name": "string",
    "description": "string - brief description",
    "role": "protagonist" | "antagonist" | "supporting" | "minor",
    "appearance": "string - physical description",
    "personality": "string - personality traits"
  }]
}`;

    const response = await this.chatCompletion(model, systemPrompt, input.script);
    return this.parseJsonResponse<CharacterExtractionOutput>(response);
  }

  async splitScenes(input: SceneSplitInput): Promise<SceneSplitOutput> {
    const model = input.model ?? DEFAULT_MODEL;

    const contextBlock = input.analysis
      ? `\nScript analysis context:\n${JSON.stringify(input.analysis)}\n`
      : '';

    const systemPrompt = `You are a scene breakdown specialist. Split the provided script into individual scenes with visual descriptions suitable for AI image generation.${contextBlock}
Return ONLY valid JSON matching this exact schema:
{
  "scenes": [{
    "sceneNumber": "number",
    "title": "string - short scene title",
    "description": "string - what happens in the scene",
    "setting": "string - location and environment",
    "mood": "string - emotional tone",
    "characters": ["string - character names present"],
    "startFrameDescription": "string - detailed visual description of the opening frame for image generation",
    "endFrameDescription": "string - detailed visual description of the closing frame for image generation",
    "estimatedDuration": "number - seconds"
  }]
}`;

    const response = await this.chatCompletion(model, systemPrompt, input.script);
    return this.parseJsonResponse<SceneSplitOutput>(response);
  }

  async generateImagePrompt(input: ImagePromptInput): Promise<ImagePromptOutput> {
    const model = input.model ?? DEFAULT_MODEL;

    const characterContext = input.characters
      .map((c) => `${c.name}: ${c.appearance}`)
      .join('\n');

    const styleNote = input.style ? `\nDesired visual style: ${input.style}` : '';

    const systemPrompt = `You are a prompt engineer for AI image generation. Generate a detailed image generation prompt from the scene description.

Character visual references:
${characterContext}${styleNote}

Return ONLY valid JSON matching this exact schema:
{
  "prompt": "string - detailed positive prompt for image generation",
  "negativePrompt": "string - things to exclude from the image",
  "suggestedWidth": "number - suggested width in pixels (e.g., 1280)",
  "suggestedHeight": "number - suggested height in pixels (e.g., 720)"
}`;

    const response = await this.chatCompletion(model, systemPrompt, input.sceneDescription);
    return this.parseJsonResponse<ImagePromptOutput>(response);
  }

  // ── Private Helpers ──

  private async chatCompletion(model: string, systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new ProviderError('Empty response from OpenAI', SLUG, {
          providerCode: 'EMPTY_RESPONSE',
        });
      }

      return content;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private parseJsonResponse<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      logger.error({ raw }, 'Failed to parse OpenAI JSON response');
      throw new ProviderError('Invalid JSON response from OpenAI', SLUG, {
        providerCode: 'INVALID_JSON',
        details: { raw: raw.slice(0, 500) },
      });
    }
  }

  private mapError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    if (error instanceof OpenAI.APIError) {
      const apiError = error as InstanceType<typeof OpenAI.APIError> & { headers?: Record<string, string> };
      const status = apiError.status;
      const message = apiError.message;
      const code = apiError.code;

      if (status === 429) {
        const retryAfter = parseRetryAfterMs(apiError.headers?.['retry-after']);
        return new ProviderRateLimitError(SLUG, retryAfter, { originalMessage: message });
      }

      if (status === 408 || code === 'timeout') {
        return new ProviderTimeoutError(SLUG, 30_000, { originalMessage: message });
      }

      return new ProviderError(message, SLUG, {
        providerCode: code ?? undefined,
        retryable: status !== undefined && status >= 500,
        statusCode: status === 401 ? 401 : 502,
        details: { originalStatus: status },
      });
    }

    const msg = error instanceof Error ? error.message : 'Unknown OpenAI error';
    return new ProviderError(msg, SLUG);
  }
}

function parseRetryAfterMs(header: string | undefined | null): number {
  if (!header) return 60_000;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : 60_000;
}
