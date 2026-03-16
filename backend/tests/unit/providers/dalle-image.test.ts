import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DalleImageAdapter } from '../../../src/providers/image-generation/dalle-image.adapter.js';
import { ProviderError, ProviderRateLimitError } from '../../../src/providers/provider.errors.js';

// Mock the openai module
const mockImagesGenerate = vi.fn();
const mockModelsList = vi.fn();

vi.mock('openai', () => {
  class MockOpenAI {
    images = { generate: mockImagesGenerate };
    models = { list: mockModelsList };
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

describe('DalleImageAdapter', () => {
  let adapter: DalleImageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new DalleImageAdapter('sk-test-key');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('dalle');
      expect(adapter.displayName).toBe('DALL-E');
      expect(adapter.category).toBe('image-generation');
    });

    it('should not be webhook-based', () => {
      expect(adapter.isWebhookBased()).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models[0].id).toBe('dall-e-3');
      expect(models[0].capabilities).toContain('text-to-image');
      expect(models[0].maxResolution).toEqual({ width: 1792, height: 1024 });
    });
  });

  describe('generate', () => {
    it('should return completed result with image URLs', async () => {
      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://oaidalleapiprodscus.blob.core.windows.net/image1.png' }],
      });

      const result = await adapter.generate({
        prompt: 'A beautiful sunset over mountains',
        model: 'dall-e-3',
        width: 1024,
        height: 1024,
      });

      expect(result.status).toBe('completed');
      expect(result.images).toHaveLength(1);
      expect(result.images![0].url).toBe('https://oaidalleapiprodscus.blob.core.windows.net/image1.png');
      expect(result.images![0].contentType).toBe('image/png');
    });

    it('should return failed when no images are returned', async () => {
      mockImagesGenerate.mockResolvedValueOnce({ data: [] });

      const result = await adapter.generate({
        prompt: 'test',
        model: 'dall-e-3',
        width: 1024,
        height: 1024,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBeTruthy();
    });
  });

  describe('size snapping logic', () => {
    it('should snap square dimensions to 1024x1024', async () => {
      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://example.com/img.png' }],
      });

      const result = await adapter.generate({
        prompt: 'test',
        model: 'dall-e-3',
        width: 1024,
        height: 1024,
      });

      expect(result.images![0].width).toBe(1024);
      expect(result.images![0].height).toBe(1024);
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ size: '1024x1024' }),
      );
    });

    it('should snap wide dimensions to 1792x1024', async () => {
      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://example.com/img.png' }],
      });

      const result = await adapter.generate({
        prompt: 'test',
        model: 'dall-e-3',
        width: 1920,
        height: 1080,
      });

      expect(result.images![0].width).toBe(1792);
      expect(result.images![0].height).toBe(1024);
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ size: '1792x1024' }),
      );
    });

    it('should snap tall dimensions to 1024x1792', async () => {
      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://example.com/img.png' }],
      });

      const result = await adapter.generate({
        prompt: 'test',
        model: 'dall-e-3',
        width: 1024,
        height: 1792,
      });

      expect(result.images![0].width).toBe(1024);
      expect(result.images![0].height).toBe(1792);
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ size: '1024x1792' }),
      );
    });
  });

  describe('n=1 enforcement for DALL-E 3', () => {
    it('should enforce n=1 for dall-e-3 even when numImages is greater', async () => {
      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://example.com/img.png' }],
      });

      await adapter.generate({
        prompt: 'test',
        model: 'dall-e-3',
        width: 1024,
        height: 1024,
        numImages: 5,
      });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ n: 1 }),
      );
    });

    it('should allow n > 1 for dall-e-2', async () => {
      mockImagesGenerate.mockResolvedValueOnce({
        data: [
          { url: 'https://example.com/img1.png' },
          { url: 'https://example.com/img2.png' },
          { url: 'https://example.com/img3.png' },
        ],
      });

      await adapter.generate({
        prompt: 'test',
        model: 'dall-e-2',
        width: 1024,
        height: 1024,
        numImages: 3,
      });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ n: 3 }),
      );
    });

    it('should cap n at 10 for dall-e-2', async () => {
      mockImagesGenerate.mockResolvedValueOnce({
        data: Array.from({ length: 10 }, (_, i) => ({
          url: `https://example.com/img${i}.png`,
        })),
      });

      await adapter.generate({
        prompt: 'test',
        model: 'dall-e-2',
        width: 1024,
        height: 1024,
        numImages: 20,
      });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ n: 10 }),
      );
    });
  });

  describe('error handling', () => {
    it('should translate rate limit errors to ProviderRateLimitError', async () => {
      mockImagesGenerate.mockRejectedValueOnce(
        Object.assign(new Error('Rate limit exceeded'), { status: 429 }),
      );

      await expect(
        adapter.generate({
          prompt: 'test',
          model: 'dall-e-3',
          width: 1024,
          height: 1024,
        }),
      ).rejects.toThrow(ProviderRateLimitError);
    });

    it('should translate server errors to retryable ProviderError', async () => {
      mockImagesGenerate.mockRejectedValueOnce(
        Object.assign(new Error('Internal server error'), { status: 500 }),
      );

      try {
        await adapter.generate({
          prompt: 'test',
          model: 'dall-e-3',
          width: 1024,
          height: 1024,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).retryable).toBe(true);
      }
    });

    it('should translate 401 errors with correct status code', async () => {
      mockImagesGenerate.mockRejectedValueOnce(
        Object.assign(new Error('Invalid API key'), { status: 401 }),
      );

      try {
        await adapter.generate({
          prompt: 'test',
          model: 'dall-e-3',
          width: 1024,
          height: 1024,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).statusCode).toBe(401);
      }
    });
  });
});
