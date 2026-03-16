import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KieImageAdapter } from '../../../src/providers/image-generation/kie-image.adapter.js';
import { ProviderError, ProviderRateLimitError } from '../../../src/providers/provider.errors.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('KieImageAdapter', () => {
  let adapter: KieImageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new KieImageAdapter('kie-test-key');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('kie');
      expect(adapter.displayName).toBe('KIE AI');
      expect(adapter.category).toBe('image-generation');
    });

    it('should be webhook-based', () => {
      expect(adapter.isWebhookBased()).toBe(true);
    });

    it('should return webhook signature header', () => {
      expect(adapter.getWebhookSignatureHeader()).toBe('authorization');
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const models = await adapter.listModels();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('kie-v1');
      expect(models[0].capabilities).toContain('text-to-image');
      expect(models[0].maxResolution).toEqual({ width: 2048, height: 2048 });
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid bearer token signature', () => {
      const payload = Buffer.from('{"event":"completed"}');
      const secret = 'my-webhook-secret';
      const signature = `Bearer ${secret}`;

      expect(adapter.verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid bearer token signature', () => {
      const payload = Buffer.from('{"event":"completed"}');
      expect(adapter.verifyWebhookSignature(payload, 'Bearer wrong-secret', 'my-webhook-secret')).toBe(false);
    });

    it('should reject mismatched length signatures', () => {
      const payload = Buffer.from('{"event":"completed"}');
      expect(adapter.verifyWebhookSignature(payload, 'short', 'my-webhook-secret')).toBe(false);
    });
  });

  describe('generate', () => {
    it('should return pending with external ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'pending',
        }),
      });

      const result = await adapter.generate({
        prompt: 'A beautiful landscape',
        model: 'kie-v1',
        width: 1024,
        height: 1024,
      });

      expect(result.status).toBe('pending');
      expect(result.externalId).toBe('kie-task-123');
      expect(result.estimatedWaitMs).toBe(30_000);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kie.ai/api/v1/generate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer kie-test-key',
          }),
        }),
      );
    });

    it('should include negative prompt and seed when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-456',
          status: 'pending',
        }),
      });

      await adapter.generate({
        prompt: 'A cat',
        negativePrompt: 'blurry, low quality',
        model: 'kie-v1',
        width: 1024,
        height: 1024,
        seed: 42,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.negative_prompt).toBe('blurry, low quality');
      expect(callBody.seed).toBe(42);
    });

    it('should include callback URL when provided in params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'kie-task-789', status: 'pending' }),
      });

      await adapter.generate({
        prompt: 'A dog',
        model: 'kie-v1',
        width: 1024,
        height: 1024,
        params: { callback_url: 'https://myapp.com/webhook/kie' },
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.callback_url).toBe('https://myapp.com/webhook/kie');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid request parameters',
      });

      await expect(
        adapter.generate({
          prompt: 'test',
          model: 'kie-v1',
          width: 1024,
          height: 1024,
        }),
      ).rejects.toThrow(ProviderError);
    });
  });

  describe('checkStatus', () => {
    it('should map completed status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'completed',
        }),
      });

      const status = await adapter.checkStatus('kie-task-123');
      expect(status.status).toBe('completed');
    });

    it('should map processing status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'processing',
        }),
      });

      const status = await adapter.checkStatus('kie-task-123');
      expect(status.status).toBe('processing');
    });

    it('should map pending status to queued', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'pending',
        }),
      });

      const status = await adapter.checkStatus('kie-task-123');
      expect(status.status).toBe('queued');
    });

    it('should map failed status with error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'failed',
          error: 'Content moderation failure',
        }),
      });

      const status = await adapter.checkStatus('kie-task-123');
      expect(status.status).toBe('failed');
      expect(status.error).toBe('Content moderation failure');
    });

    it('should handle API errors during status check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });

      await expect(adapter.checkStatus('kie-task-123')).rejects.toThrow(ProviderError);
    });
  });

  describe('getResult', () => {
    it('should return completed result with images', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'completed',
          result: {
            images: [
              { url: 'https://kie.ai/result/image1.png', width: 1024, height: 1024 },
            ],
          },
        }),
      });

      const result = await adapter.getResult('kie-task-123');
      expect(result.status).toBe('completed');
      expect(result.externalId).toBe('kie-task-123');
      expect(result.images).toHaveLength(1);
      expect(result.images![0].url).toBe('https://kie.ai/result/image1.png');
      expect(result.images![0].width).toBe(1024);
      expect(result.images![0].height).toBe(1024);
      expect(result.images![0].contentType).toBe('image/png');
    });

    it('should return failed for failed tasks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'failed',
          error: 'Generation timed out',
        }),
      });

      const result = await adapter.getResult('kie-task-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Generation timed out');
    });

    it('should return failed for error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'error',
          error: 'Internal processing error',
        }),
      });

      const result = await adapter.getResult('kie-task-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Internal processing error');
    });

    it('should return failed when no images in result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'completed',
          result: { images: [] },
        }),
      });

      const result = await adapter.getResult('kie-task-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('No images in result');
    });

    it('should return failed when result has no images property', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kie-task-123',
          status: 'completed',
        }),
      });

      const result = await adapter.getResult('kie-task-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('No images in result');
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
          model: 'kie-v1',
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
          model: 'kie-v1',
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
          model: 'kie-v1',
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
