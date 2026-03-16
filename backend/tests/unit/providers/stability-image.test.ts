import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StabilityImageAdapter } from '../../../src/providers/image-generation/stability-image.adapter.js';
import { ProviderError, ProviderRateLimitError } from '../../../src/providers/provider.errors.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('StabilityImageAdapter', () => {
  let adapter: StabilityImageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new StabilityImageAdapter('stab-test-key');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('stability');
      expect(adapter.displayName).toBe('Stability AI');
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
      expect(models[0].id).toBe('stable-diffusion-xl-1024-v1-0');
      expect(models[0].capabilities).toContain('text-to-image');
      expect(models[0].maxResolution).toEqual({ width: 1024, height: 1024 });
    });
  });

  describe('generate', () => {
    it('should return completed result with base64 data URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artifacts: [
            { base64: 'iVBORw0KGgoAAAANS', finishReason: 'SUCCESS', seed: 12345 },
          ],
        }),
      });

      const result = await adapter.generate({
        prompt: 'A beautiful sunset over mountains',
        model: 'stable-diffusion-xl-1024-v1-0',
        width: 1024,
        height: 1024,
      });

      expect(result.status).toBe('completed');
      expect(result.images).toHaveLength(1);
      expect(result.images![0].url).toBe('data:image/png;base64,iVBORw0KGgoAAAANS');
      expect(result.images![0].width).toBe(1024);
      expect(result.images![0].height).toBe(1024);
      expect(result.images![0].contentType).toBe('image/png');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer stab-test-key',
          }),
        }),
      );
    });

    it('should pass negative prompt with negative weight', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artifacts: [{ base64: 'abc123', finishReason: 'SUCCESS', seed: 1 }],
        }),
      });

      await adapter.generate({
        prompt: 'A cat',
        negativePrompt: 'blurry, low quality',
        model: 'stable-diffusion-xl-1024-v1-0',
        width: 1024,
        height: 1024,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.text_prompts).toEqual(
        expect.arrayContaining([
          { text: 'A cat', weight: 1 },
          { text: 'blurry, low quality', weight: -1 },
        ]),
      );
    });

    it('should pass seed when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artifacts: [{ base64: 'abc', finishReason: 'SUCCESS', seed: 42 }],
        }),
      });

      await adapter.generate({
        prompt: 'A dog',
        model: 'stable-diffusion-xl-1024-v1-0',
        width: 1024,
        height: 1024,
        seed: 42,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.seed).toBe(42);
    });

    it('should return failed when no artifacts are returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ artifacts: [] }),
      });

      const result = await adapter.generate({
        prompt: 'test',
        model: 'stable-diffusion-xl-1024-v1-0',
        width: 1024,
        height: 1024,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBeTruthy();
    });

    it('should generate multiple images when numImages specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artifacts: [
            { base64: 'img1', finishReason: 'SUCCESS', seed: 1 },
            { base64: 'img2', finishReason: 'SUCCESS', seed: 2 },
          ],
        }),
      });

      const result = await adapter.generate({
        prompt: 'test',
        model: 'stable-diffusion-xl-1024-v1-0',
        width: 1024,
        height: 1024,
        numImages: 2,
      });

      expect(result.images).toHaveLength(2);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.samples).toBe(2);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request: invalid dimensions',
      });

      await expect(
        adapter.generate({
          prompt: 'test',
          model: 'stable-diffusion-xl-1024-v1-0',
          width: 1024,
          height: 1024,
        }),
      ).rejects.toThrow(ProviderError);
    });
  });

  describe('error handling', () => {
    it('should translate rate limit to ProviderRateLimitError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(
        adapter.generate({
          prompt: 'test',
          model: 'stable-diffusion-xl-1024-v1-0',
          width: 1024,
          height: 1024,
        }),
      ).rejects.toThrow(ProviderRateLimitError);
    });

    it('should translate server errors to retryable ProviderError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      try {
        await adapter.generate({
          prompt: 'test',
          model: 'stable-diffusion-xl-1024-v1-0',
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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      try {
        await adapter.generate({
          prompt: 'test',
          model: 'stable-diffusion-xl-1024-v1-0',
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
