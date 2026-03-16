import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FalImageAdapter } from '../../../src/providers/image-generation/fal-image.adapter.js';
import { ProviderError, ProviderRateLimitError } from '../../../src/providers/provider.errors.js';

// Mock the @fal-ai/client module
const { mockSubscribe, mockQueueSubmit, mockQueueStatus, mockQueueResult, mockConfig } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockQueueSubmit: vi.fn(),
  mockQueueStatus: vi.fn(),
  mockQueueResult: vi.fn(),
  mockConfig: vi.fn(),
}));

vi.mock('@fal-ai/client', () => ({
  fal: {
    config: mockConfig,
    subscribe: mockSubscribe,
    queue: {
      submit: mockQueueSubmit,
      status: mockQueueStatus,
      result: mockQueueResult,
    },
  },
}));

describe('FalImageAdapter', () => {
  let adapter: FalImageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new FalImageAdapter('fal-test-key');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('fal');
      expect(adapter.displayName).toBe('FAL AI');
      expect(adapter.category).toBe('image-generation');
    });

    it('should not be webhook-based', () => {
      expect(adapter.isWebhookBased()).toBe(false);
    });

    it('should configure fal client with api key on construction', () => {
      expect(mockConfig).toHaveBeenCalledWith({ credentials: 'fal-test-key' });
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThanOrEqual(3);
      expect(models[0].id).toBe('fal-ai/flux/dev');
      expect(models[0].maxResolution).toEqual({ width: 2048, height: 2048 });
    });
  });

  describe('generate', () => {
    it('should return completed result with image URLs', async () => {
      mockSubscribe.mockResolvedValueOnce({
        images: [
          { url: 'https://fal.ai/result/image1.png', width: 1024, height: 1024, content_type: 'image/png' },
        ],
        request_id: 'req-123',
      });

      const result = await adapter.generate({
        prompt: 'A beautiful sunset over mountains',
        model: 'fal-ai/flux/dev',
        width: 1024,
        height: 1024,
      });

      expect(result.status).toBe('completed');
      expect(result.images).toHaveLength(1);
      expect(result.images![0].url).toBe('https://fal.ai/result/image1.png');
      expect(result.images![0].width).toBe(1024);
      expect(result.externalId).toBe('req-123');

      expect(mockSubscribe).toHaveBeenCalledWith('fal-ai/flux/dev', {
        input: expect.objectContaining({
          prompt: 'A beautiful sunset over mountains',
          image_size: { width: 1024, height: 1024 },
          num_images: 1,
        }),
      });
    });

    it('should pass negative prompt and seed when provided', async () => {
      mockSubscribe.mockResolvedValueOnce({
        images: [{ url: 'https://fal.ai/result/img.png', width: 512, height: 512 }],
      });

      await adapter.generate({
        prompt: 'A cat',
        negativePrompt: 'blurry, low quality',
        model: 'fal-ai/flux/dev',
        width: 512,
        height: 512,
        seed: 42,
      });

      expect(mockSubscribe).toHaveBeenCalledWith('fal-ai/flux/dev', {
        input: expect.objectContaining({
          negative_prompt: 'blurry, low quality',
          seed: 42,
        }),
      });
    });

    it('should pass reference image URL when provided', async () => {
      mockSubscribe.mockResolvedValueOnce({
        images: [{ url: 'https://fal.ai/result/img.png', width: 512, height: 512 }],
      });

      await adapter.generate({
        prompt: 'A variation',
        model: 'fal-ai/flux/dev',
        width: 512,
        height: 512,
        referenceImages: [{ url: 'https://example.com/ref.jpg', weight: 0.8 }],
      });

      expect(mockSubscribe).toHaveBeenCalledWith('fal-ai/flux/dev', {
        input: expect.objectContaining({
          image_url: 'https://example.com/ref.jpg',
        }),
      });
    });

    it('should return failed when no images are returned', async () => {
      mockSubscribe.mockResolvedValueOnce({ images: [] });

      const result = await adapter.generate({
        prompt: 'test',
        model: 'fal-ai/flux/dev',
        width: 512,
        height: 512,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBeTruthy();
    });

    it('should generate multiple images when numImages specified', async () => {
      mockSubscribe.mockResolvedValueOnce({
        images: [
          { url: 'https://fal.ai/1.png', width: 1024, height: 1024 },
          { url: 'https://fal.ai/2.png', width: 1024, height: 1024 },
        ],
      });

      const result = await adapter.generate({
        prompt: 'test',
        model: 'fal-ai/flux/dev',
        width: 1024,
        height: 1024,
        numImages: 2,
      });

      expect(result.images).toHaveLength(2);
    });
  });

  describe('checkStatus', () => {
    it('should map IN_QUEUE to queued', async () => {
      mockQueueStatus.mockResolvedValueOnce({ status: 'IN_QUEUE' });

      const status = await adapter.checkStatus('req-123');
      expect(status.status).toBe('queued');
    });

    it('should map IN_PROGRESS to processing', async () => {
      mockQueueStatus.mockResolvedValueOnce({ status: 'IN_PROGRESS' });

      const status = await adapter.checkStatus('req-123');
      expect(status.status).toBe('processing');
    });

    it('should map COMPLETED to completed', async () => {
      mockQueueStatus.mockResolvedValueOnce({ status: 'COMPLETED' });

      const status = await adapter.checkStatus('req-123');
      expect(status.status).toBe('completed');
    });
  });

  describe('getResult', () => {
    it('should return completed result', async () => {
      mockQueueResult.mockResolvedValueOnce({
        data: {
          images: [{ url: 'https://fal.ai/result.png', width: 1024, height: 1024, content_type: 'image/png' }],
        },
      });

      const result = await adapter.getResult('req-123');
      expect(result.status).toBe('completed');
      expect(result.images).toHaveLength(1);
    });

    it('should return failed when no images in result', async () => {
      mockQueueResult.mockResolvedValueOnce({ data: { images: [] } });

      const result = await adapter.getResult('req-123');
      expect(result.status).toBe('failed');
    });
  });

  describe('error handling', () => {
    it('should translate rate limit to ProviderRateLimitError', async () => {
      mockSubscribe.mockRejectedValueOnce({ status: 429, message: 'Too many requests' });

      await expect(
        adapter.generate({ prompt: 'test', model: 'fal-ai/flux/dev', width: 512, height: 512 }),
      ).rejects.toThrow(ProviderRateLimitError);
    });

    it('should wrap unknown errors as ProviderError', async () => {
      mockSubscribe.mockRejectedValueOnce({ status: 500, message: 'Internal error' });

      await expect(
        adapter.generate({ prompt: 'test', model: 'fal-ai/flux/dev', width: 512, height: 512 }),
      ).rejects.toThrow(ProviderError);
    });
  });
});
