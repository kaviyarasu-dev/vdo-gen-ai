import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { PikaVideoAdapter } from '../../../src/providers/video-generation/pika-video.adapter.js';
import { ProviderError, ProviderRateLimitError, ProviderTimeoutError } from '../../../src/providers/provider.errors.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('PikaVideoAdapter', () => {
  let adapter: PikaVideoAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PikaVideoAdapter('pika-test-key', 'webhook-secret');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('pika');
      expect(adapter.displayName).toBe('Pika');
      expect(adapter.category).toBe('video-generation');
    });

    it('should be webhook-based', () => {
      expect(adapter.isWebhookBased()).toBe(true);
    });

    it('should return webhook signature header', () => {
      expect(adapter.getWebhookSignatureHeader()).toBe('x-pika-signature');
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models[0].id).toBe('pika-v2');
      expect(models[0].maxDuration).toBe(10);
      expect(models[0].capabilities).toContain('image-to-video');
      expect(models[0].capabilities).toContain('text-to-video');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC-SHA256 signatures', () => {
      const payload = Buffer.from('{"event":"generation.completed"}');
      const secret = 'webhook-secret';
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      expect(adapter.verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const payload = Buffer.from('{"event":"generation.completed"}');
      expect(adapter.verifyWebhookSignature(payload, 'invalid-signature', 'webhook-secret')).toBe(false);
    });

    it('should reject tampered payloads', () => {
      const payload = Buffer.from('{"event":"generation.completed"}');
      const secret = 'webhook-secret';
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      const tamperedPayload = Buffer.from('{"event":"generation.failed"}');
      expect(adapter.verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(false);
    });
  });

  describe('submit', () => {
    it('should submit a video generation task', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pika-gen-123',
          status: 'queued',
        }),
      });

      const result = await adapter.submit({
        prompt: 'A hero walks through a forest',
        model: 'pika-v2',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 5,
      });

      expect(result.externalId).toBe('pika-gen-123');
      expect(result.status).toBe('queued');
      expect(result.estimatedWaitMs).toBe(90_000);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.pika.art/v1/generate/image-to-video',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer pika-test-key',
          }),
        }),
      );
    });

    it('should return processing status when task is already processing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pika-gen-456',
          status: 'processing',
        }),
      });

      const result = await adapter.submit({
        prompt: 'A sunset scene',
        model: 'pika-v2',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 10,
      });

      expect(result.status).toBe('processing');
    });

    it('should include callback URL and aspect ratio when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pika-gen-789',
          status: 'queued',
        }),
      });

      await adapter.submit({
        prompt: 'A sunset scene',
        model: 'pika-v2',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 5,
        aspectRatio: '16:9',
        callbackUrl: 'https://myapp.com/webhook/pika',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.aspect_ratio).toBe('16:9');
      expect(callBody.callback_url).toBe('https://myapp.com/webhook/pika');
    });

    it('should send image URL in the image field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pika-gen-100', status: 'queued' }),
      });

      await adapter.submit({
        prompt: 'A scene',
        model: 'pika-v2',
        startFrameUrl: 'https://example.com/start-frame.jpg',
        duration: 5,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.image).toBe('https://example.com/start-frame.jpg');
    });

    it('should handle API errors on submit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid API key' }),
      });

      await expect(
        adapter.submit({
          prompt: 'test',
          model: 'pika-v2',
          startFrameUrl: 'https://example.com/frame.jpg',
          duration: 5,
        }),
      ).rejects.toThrow(ProviderError);
    });
  });

  describe('checkStatus', () => {
    it('should map queued to queued', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gen-123', status: 'queued' }),
      });

      const status = await adapter.checkStatus('gen-123');
      expect(status.status).toBe('queued');
    });

    it('should map processing to processing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gen-123', status: 'processing' }),
      });

      const status = await adapter.checkStatus('gen-123');
      expect(status.status).toBe('processing');
    });

    it('should map completed to completed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gen-123', status: 'completed' }),
      });

      const status = await adapter.checkStatus('gen-123');
      expect(status.status).toBe('completed');
    });

    it('should map failed to failed with error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-123',
          status: 'failed',
          error: 'Content violation detected',
        }),
      });

      const status = await adapter.checkStatus('gen-123');
      expect(status.status).toBe('failed');
      expect(status.error).toBe('Content violation detected');
    });

    it('should handle API errors during status check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Not found' }),
      });

      await expect(adapter.checkStatus('gen-123')).rejects.toThrow(ProviderError);
    });
  });

  describe('getResult', () => {
    it('should return completed result with video URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-123',
          status: 'completed',
          video: {
            url: 'https://pika.art/video/output.mp4',
            duration: 5,
          },
        }),
      });

      const result = await adapter.getResult('gen-123');
      expect(result.status).toBe('completed');
      expect(result.externalId).toBe('gen-123');
      expect(result.videoUrl).toBe('https://pika.art/video/output.mp4');
      expect(result.duration).toBe(5);
    });

    it('should return failed for failed tasks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-123',
          status: 'failed',
          error: 'Generation failed due to content policy',
        }),
      });

      const result = await adapter.getResult('gen-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Generation failed due to content policy');
    });

    it('should throw ProviderError for incomplete tasks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-123',
          status: 'processing',
        }),
      });

      await expect(adapter.getResult('gen-123')).rejects.toThrow(ProviderError);
    });

    it('should return failed when no video URL in completed generation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-123',
          status: 'completed',
          video: null,
        }),
      });

      const result = await adapter.getResult('gen-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('No output URL in completed generation');
    });
  });

  describe('waitForResult', () => {
    it('should poll and return completed result', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'gen-123', status: 'queued' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'gen-123', status: 'processing' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'gen-123', status: 'completed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'gen-123',
            status: 'completed',
            video: { url: 'https://pika.art/video.mp4', duration: 5 },
          }),
        });

      const onProgress = vi.fn();

      const result = await adapter.waitForResult('gen-123', {
        intervalMs: 10,
        maxAttempts: 10,
        onProgress,
      });

      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBe('https://pika.art/video.mp4');
      expect(onProgress).toHaveBeenCalledTimes(3);
    });

    it('should return failed result when task fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-123',
          status: 'failed',
          error: 'Content violation',
        }),
      });

      const result = await adapter.waitForResult('gen-123', {
        intervalMs: 10,
        maxAttempts: 5,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Content violation');
    });

    it('should throw ProviderTimeoutError when max attempts exceeded', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'gen-123', status: 'processing' }),
      });

      await expect(
        adapter.waitForResult('gen-123', { intervalMs: 10, maxAttempts: 3 }),
      ).rejects.toThrow(ProviderTimeoutError);
    });
  });

  describe('error handling', () => {
    it('should translate rate limit errors to ProviderRateLimitError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Rate limit exceeded' }),
        status: 429,
      });

      await expect(
        adapter.submit({
          prompt: 'test',
          model: 'pika-v2',
          startFrameUrl: 'https://example.com/frame.jpg',
          duration: 5,
        }),
      ).rejects.toThrow(ProviderRateLimitError);
    });

    it('should translate server errors to retryable ProviderError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Internal server error' }),
        status: 500,
      });

      try {
        await adapter.submit({
          prompt: 'test',
          model: 'pika-v2',
          startFrameUrl: 'https://example.com/frame.jpg',
          duration: 5,
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
        json: async () => ({ message: 'Invalid API key' }),
        status: 401,
      });

      try {
        await adapter.submit({
          prompt: 'test',
          model: 'pika-v2',
          startFrameUrl: 'https://example.com/frame.jpg',
          duration: 5,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).statusCode).toBe(401);
      }
    });
  });
});
