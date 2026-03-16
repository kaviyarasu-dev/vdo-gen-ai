import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicTextAdapter } from '../../../src/providers/text-analysis/anthropic-text.adapter.js';
import { ProviderError, ProviderRateLimitError } from '../../../src/providers/provider.errors.js';

// Mock the @anthropic-ai/sdk module
vi.mock('@anthropic-ai/sdk', () => {
  const createMock = vi.fn();

  class MockAnthropic {
    messages = { create: createMock };
  }

  class APIError extends Error {
    status: number;
    headers: Record<string, string>;
    constructor(status: number, message: string, headers: Record<string, string> = {}) {
      super(message);
      this.name = 'APIError';
      this.status = status;
      this.headers = headers;
    }
  }

  const MockAnthropicDefault = MockAnthropic as unknown as { APIError: typeof APIError };
  MockAnthropicDefault.APIError = APIError;

  return {
    default: MockAnthropic,
    Anthropic: MockAnthropic,
  };
});

// Helper to get the mocked messages.create function
async function getMockedCreate() {
  const anthropicModule = await import('@anthropic-ai/sdk');
  const instance = new (anthropicModule.default as unknown as new () => { messages: { create: ReturnType<typeof vi.fn> } })();
  return instance.messages.create;
}

describe('AnthropicTextAdapter', () => {
  let adapter: AnthropicTextAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AnthropicTextAdapter('sk-ant-test-key');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('anthropic');
      expect(adapter.displayName).toBe('Anthropic');
      expect(adapter.category).toBe('text-analysis');
    });

    it('should not be webhook-based', () => {
      expect(adapter.isWebhookBased()).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models[0].id).toBe('claude-sonnet-4-20250514');
      expect(models[0].capabilities).toContain('script-analysis');
    });
  });

  describe('analyzeScript', () => {
    it('should return structured analysis for a valid script', async () => {
      const mockResponse = {
        title: 'The Quest',
        genre: 'Fantasy',
        tone: 'Epic',
        totalScenes: 5,
        characters: [{ name: 'Hero', description: 'A brave warrior' }],
        themes: ['courage', 'friendship'],
        summary: 'A hero embarks on a quest to save the kingdom.',
      };

      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
      });

      const result = await adapter.analyzeScript({ script: 'Once upon a time...' });

      expect(result.title).toBe('The Quest');
      expect(result.genre).toBe('Fantasy');
      expect(result.totalScenes).toBe(5);
      expect(result.characters).toHaveLength(1);
      expect(result.themes).toContain('courage');
      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
        }),
      );
    });

    it('should use custom model when specified', async () => {
      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"title":"T","genre":"G","tone":"T","totalScenes":1,"characters":[],"themes":[],"summary":"S"}' }],
      });

      await adapter.analyzeScript({ script: 'test', model: 'claude-3-5-haiku-20241022' });

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-3-5-haiku-20241022' }),
      );
    });

    it('should throw ProviderError on empty response', async () => {
      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [],
      });

      await expect(adapter.analyzeScript({ script: 'test' })).rejects.toThrow(ProviderError);
    });

    it('should strip markdown code fences from JSON response', async () => {
      const mockResponse = {
        title: 'Test',
        genre: 'Drama',
        tone: 'Serious',
        totalScenes: 2,
        characters: [],
        themes: ['loss'],
        summary: 'A drama about loss.',
      };

      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [{ type: 'text', text: '```json\n' + JSON.stringify(mockResponse) + '\n```' }],
      });

      const result = await adapter.analyzeScript({ script: 'test' });
      expect(result.title).toBe('Test');
      expect(result.genre).toBe('Drama');
    });
  });

  describe('extractCharacters', () => {
    it('should return extracted characters', async () => {
      const mockResponse = {
        characters: [
          {
            name: 'Alice',
            description: 'A curious girl',
            role: 'protagonist',
            appearance: 'Blonde hair, blue dress',
            personality: 'Curious, brave',
          },
        ],
      };

      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
      });

      const result = await adapter.extractCharacters({ script: 'Alice fell down the rabbit hole.' });

      expect(result.characters).toHaveLength(1);
      expect(result.characters[0].name).toBe('Alice');
      expect(result.characters[0].role).toBe('protagonist');
    });
  });

  describe('splitScenes', () => {
    it('should return scenes with start/end frame descriptions', async () => {
      const mockResponse = {
        scenes: [
          {
            sceneNumber: 1,
            title: 'Opening',
            description: 'The hero wakes up',
            setting: 'A small village',
            mood: 'peaceful',
            characters: ['Hero'],
            startFrameDescription: 'Wide shot of a sleeping village at dawn',
            endFrameDescription: 'Close-up of the hero opening their eyes',
            estimatedDuration: 15,
          },
        ],
      };

      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
      });

      const result = await adapter.splitScenes({ script: 'The hero wakes in a small village...' });

      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].startFrameDescription).toBeTruthy();
      expect(result.scenes[0].endFrameDescription).toBeTruthy();
      expect(result.scenes[0].estimatedDuration).toBe(15);
    });
  });

  describe('generateImagePrompt', () => {
    it('should return image generation prompt', async () => {
      const mockResponse = {
        prompt: 'A brave warrior standing in a sunlit forest clearing, photorealistic',
        negativePrompt: 'blurry, low quality, cartoon',
        suggestedWidth: 1280,
        suggestedHeight: 720,
      };

      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
      });

      const result = await adapter.generateImagePrompt({
        sceneDescription: 'The hero stands in a forest clearing',
        characters: [{ name: 'Hero', appearance: 'Tall, armored warrior' }],
        style: 'photorealistic',
      });

      expect(result.prompt).toContain('warrior');
      expect(result.negativePrompt).toBeTruthy();
      expect(result.suggestedWidth).toBe(1280);
    });
  });

  describe('error handling', () => {
    it('should translate rate limit errors to ProviderRateLimitError', async () => {
      const anthropicModule = await import('@anthropic-ai/sdk');
      const Anthropic = anthropicModule.default as unknown as { APIError: new (status: number, message: string, headers: Record<string, string>) => Error };

      const createFn = await getMockedCreate();
      createFn.mockRejectedValueOnce(
        new Anthropic.APIError(429, 'Rate limit exceeded', { 'retry-after': '30' }),
      );

      await expect(adapter.analyzeScript({ script: 'test' })).rejects.toThrow(ProviderRateLimitError);
    });

    it('should translate invalid JSON to ProviderError', async () => {
      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not valid json {{{' }],
      });

      await expect(adapter.analyzeScript({ script: 'test' })).rejects.toThrow(ProviderError);
    });

    it('should translate non-text block response to ProviderError', async () => {
      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'tool_1', name: 'test', input: {} }],
      });

      await expect(adapter.analyzeScript({ script: 'test' })).rejects.toThrow(ProviderError);
    });
  });
});
