import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { KlingVideoAdapter } from '../../../src/providers/video-generation/kling-video.adapter.js';
import { ProviderError, ProviderRateLimitError, ProviderTimeoutError } from '../../../src/providers/provider.errors.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('KlingVideoAdapter', () => {
  let adapter: KlingVideoAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new KlingVideoAdapter('kling-test-key', 'webhook-secret');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('kling');
      expect(adapter.displayName).toBe('Kling');
      expect(adapter.category).toBe('video-generation');
    });

    it('should be webhook-based', () => {
      expect(adapter.isWebhookBased()).toBe(true);
    });

    it('should return webhook signature header', () => {
      expect(adapter.getWebhookSignatureHeader()).toBe('x-kling-signature');
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models[0].id).toBe('kling-v1');
      expect(models[0].maxDuration).toBe(10);
      expect(models[0].capabilities).toContain('image-to-video');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC-SHA256 signatures', () => {
      const payload = Buffer.from('{"event":"task.completed"}');
      const secret = 'webhook-secret';
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      expect(adapter.verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const payload = Buffer.from('{"event":"task.completed"}');
      expect(adapter.verifyWebhookSignature(payload, 'invalid-signature', 'webhook-secret')).toBe(false);
    });

    it('should reject tampered payloads', () => {
      const payload = Buffer.from('{"event":"task.completed"}');
      const secret = 'webhook-secret';
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      const tamperedPayload = Buffer.from('{"event":"task.failed"}');
      expect(adapter.verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(false);
    });
  });

  describe('submit', () => {
    it('should submit a video generation task', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'kling-task-123',
          task_status: 'submitted',
        }),
      });

      const result = await adapter.submit({
        prompt: 'A hero walks through a forest',
        model: 'kling-v1',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 5,
      });

      expect(result.externalId).toBe('kling-task-123');
      expect(result.status).toBe('queued');
      expect(result.estimatedWaitMs).toBe(120_000);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.klingai.com/v1/videos/image-to-video',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer kling-test-key',
          }),
        }),
      );
    });

    it('should return processing status when task is already processing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'kling-task-456',
          task_status: 'processing',
        }),
      });

      const result = await adapter.submit({
        prompt: 'A sunset scene',
        model: 'kling-v1',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 10,
      });

      expect(result.status).toBe('processing');
    });

    it('should include callback URL and aspect ratio when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'kling-task-789',
          task_status: 'submitted',
        }),
      });

      await adapter.submit({
        prompt: 'A sunset scene',
        model: 'kling-v1',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 5,
        aspectRatio: '16:9',
        callbackUrl: 'https://myapp.com/webhook/kling',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.aspect_ratio).toBe('16:9');
      expect(callBody.callback_url).toBe('https://myapp.com/webhook/kling');
    });

    it('should handle API errors on submit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid API key' }),
      });

      await expect(
        adapter.submit({
          prompt: 'test',
          model: 'kling-v1',
          startFrameUrl: 'https://example.com/frame.jpg',
          duration: 5,
        }),
      ).rejects.toThrow(ProviderError);
    });
  });

  describe('checkStatus', () => {
    it('should map submitted to queued', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-123', task_status: 'submitted' }),
      });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('queued');
    });

    it('should map processing to processing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-123', task_status: 'processing' }),
      });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('processing');
    });

    it('should map succeed to completed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-123', task_status: 'succeed' }),
      });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('completed');
    });

    it('should map failed to failed with error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'task-123',
          task_status: 'failed',
          task_status_msg: 'Content violation detected',
        }),
      });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('failed');
      expect(status.error).toBe('Content violation detected');
    });

    it('should handle API errors during status check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Not found' }),
      });

      await expect(adapter.checkStatus('task-123')).rejects.toThrow(ProviderError);
    });
  });

  describe('getResult', () => {
    it('should return completed result with video URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'task-123',
          task_status: 'succeed',
          task_result: {
            videos: [{ url: 'https://kling.ai/video/output.mp4', duration: 5 }],
          },
        }),
      });

      const result = await adapter.getResult('task-123');
      expect(result.status).toBe('completed');
      expect(result.externalId).toBe('task-123');
      expect(result.videoUrl).toBe('https://kling.ai/video/output.mp4');
      expect(result.duration).toBe(5);
    });

    it('should return failed for failed tasks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'task-123',
          task_status: 'failed',
          task_status_msg: 'Generation failed due to content policy',
        }),
      });

      const result = await adapter.getResult('task-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Generation failed due to content policy');
    });

    it('should throw ProviderError for incomplete tasks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'task-123',
          task_status: 'processing',
        }),
      });

      await expect(adapter.getResult('task-123')).rejects.toThrow(ProviderError);
    });

    it('should return failed when no video URL in completed task', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'task-123',
          task_status: 'succeed',
          task_result: { videos: [] },
        }),
      });

      const result = await adapter.getResult('task-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('No output URL in completed task');
    });
  });

  describe('waitForResult', () => {
    it('should poll and return completed result', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ task_id: 'task-123', task_status: 'submitted' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ task_id: 'task-123', task_status: 'processing' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ task_id: 'task-123', task_status: 'succeed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            task_id: 'task-123',
            task_status: 'succeed',
            task_result: { videos: [{ url: 'https://kling.ai/video.mp4', duration: 5 }] },
          }),
        });

      const onProgress = vi.fn();

      const result = await adapter.waitForResult('task-123', {
        intervalMs: 10,
        maxAttempts: 10,
        onProgress,
      });

      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBe('https://kling.ai/video.mp4');
      expect(onProgress).toHaveBeenCalledTimes(3);
    });

    it('should return failed result when task fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_id: 'task-123',
          task_status: 'failed',
          task_status_msg: 'Content violation',
        }),
      });

      const result = await adapter.waitForResult('task-123', {
        intervalMs: 10,
        maxAttempts: 5,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Content violation');
    });

    it('should throw ProviderTimeoutError when max attempts exceeded', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ task_id: 'task-123', task_status: 'processing' }),
      });

      await expect(
        adapter.waitForResult('task-123', { intervalMs: 10, maxAttempts: 3 }),
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
          model: 'kling-v1',
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
          model: 'kling-v1',
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
          model: 'kling-v1',
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
