import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAITextAdapter } from '../../../src/providers/text-analysis/openai-text.adapter.js';
import { ProviderError, ProviderRateLimitError } from '../../../src/providers/provider.errors.js';

// Mock the OpenAI module
vi.mock('openai', () => {
  const createMock = vi.fn();
  const listMock = vi.fn();

  class MockOpenAI {
    chat = { completions: { create: createMock } };
    models = { list: listMock };
  }

  class APIError extends Error {
    status: number;
    code: string | null;
    headers: Record<string, string>;
    constructor(status: number, message: string, code: string | null = null, headers: Record<string, string> = {}) {
      super(message);
      this.name = 'APIError';
      this.status = status;
      this.code = code;
      this.headers = headers;
    }
  }

  const MockOpenAIDefault = MockOpenAI as unknown as { APIError: typeof APIError };
  MockOpenAIDefault.APIError = APIError;

  return {
    default: MockOpenAI,
    OpenAI: MockOpenAI,
  };
});

// Helper to get the mocked create function
async function getMockedCreate() {
  const openaiModule = await import('openai');
  const instance = new (openaiModule.default as unknown as new () => { chat: { completions: { create: ReturnType<typeof vi.fn> } } })();
  return instance.chat.completions.create;
}

describe('OpenAITextAdapter', () => {
  let adapter: OpenAITextAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAITextAdapter('sk-test-key');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('openai');
      expect(adapter.displayName).toBe('OpenAI');
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
      expect(models[0].id).toBe('gpt-4o');
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
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      });

      const result = await adapter.analyzeScript({ script: 'Once upon a time...' });

      expect(result.title).toBe('The Quest');
      expect(result.genre).toBe('Fantasy');
      expect(result.totalScenes).toBe(5);
      expect(result.characters).toHaveLength(1);
      expect(result.themes).toContain('courage');
      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should use custom model when specified', async () => {
      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        choices: [{ message: { content: '{"title":"T","genre":"G","tone":"T","totalScenes":1,"characters":[],"themes":[],"summary":"S"}' } }],
      });

      await adapter.analyzeScript({ script: 'test', model: 'gpt-4o-mini' });

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' }),
      );
    });

    it('should throw ProviderError on empty response', async () => {
      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(adapter.analyzeScript({ script: 'test' })).rejects.toThrow(ProviderError);
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
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
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
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
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
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
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
      const openaiModule = await import('openai');
      const OpenAI = openaiModule.default as unknown as { APIError: new (status: number, message: string, code: string | null, headers: Record<string, string>) => Error };

      const createFn = await getMockedCreate();
      createFn.mockRejectedValueOnce(
        new OpenAI.APIError(429, 'Rate limit exceeded', null, { 'retry-after': '30' }),
      );

      await expect(adapter.analyzeScript({ script: 'test' })).rejects.toThrow(ProviderRateLimitError);
    });

    it('should translate invalid JSON to ProviderError', async () => {
      const createFn = await getMockedCreate();
      createFn.mockResolvedValueOnce({
        choices: [{ message: { content: 'not valid json {{{' } }],
      });

      await expect(adapter.analyzeScript({ script: 'test' })).rejects.toThrow(ProviderError);
    });
  });
});
