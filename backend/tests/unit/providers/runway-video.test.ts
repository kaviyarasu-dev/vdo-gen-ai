import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunwayVideoAdapter } from '../../../src/providers/video-generation/runway-video.adapter.js';
import { ProviderError, ProviderRateLimitError, ProviderTimeoutError } from '../../../src/providers/provider.errors.js';

// Mock the @runwayml/sdk module
const mockImageToVideoCreate = vi.fn();
const mockTasksRetrieve = vi.fn();

vi.mock('@runwayml/sdk', () => {
  class MockRunwayML {
    imageToVideo = { create: mockImageToVideoCreate };
    tasks = { retrieve: mockTasksRetrieve };
  }
  return { default: MockRunwayML };
});

describe('RunwayVideoAdapter', () => {
  let adapter: RunwayVideoAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new RunwayVideoAdapter('rw-test-key', 'webhook-secret');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('runway');
      expect(adapter.displayName).toBe('Runway');
      expect(adapter.category).toBe('video-generation');
    });

    it('should be webhook-based', () => {
      expect(adapter.isWebhookBased()).toBe(true);
    });

    it('should return webhook signature header', () => {
      expect(adapter.getWebhookSignatureHeader()).toBe('x-runway-signature');
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models[0].id).toBe('gen4_turbo');
      expect(models[0].maxDuration).toBe(10);
      expect(models[0].capabilities).toContain('image-to-video');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signatures', () => {
      const { createHmac } = require('node:crypto');
      const payload = Buffer.from('{"event":"task.completed"}');
      const secret = 'webhook-secret';
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      expect(adapter.verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid webhook signatures', () => {
      const payload = Buffer.from('{"event":"task.completed"}');
      expect(adapter.verifyWebhookSignature(payload, 'invalid-signature', 'webhook-secret')).toBe(false);
    });
  });

  describe('submit', () => {
    it('should submit a video generation task', async () => {
      mockImageToVideoCreate.mockResolvedValueOnce({
        id: 'task-abc-123',
        status: 'PENDING',
        estimatedTimeToStartSeconds: 30,
      });

      const result = await adapter.submit({
        prompt: 'A hero walks through a forest',
        model: 'gen4_turbo',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 5,
      });

      expect(result.externalId).toBe('task-abc-123');
      expect(result.status).toBe('queued');
      expect(result.estimatedWaitMs).toBe(30_000);
    });

    it('should include callback URL and aspect ratio when provided', async () => {
      mockImageToVideoCreate.mockResolvedValueOnce({
        id: 'task-456',
        status: 'RUNNING',
        estimatedTimeToStartSeconds: 20,
      });

      const result = await adapter.submit({
        prompt: 'A sunset scene',
        model: 'gen4_turbo',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 10,
        aspectRatio: '16:9',
        callbackUrl: 'https://myapp.com/webhook/runway',
      });

      expect(result.status).toBe('processing');
      expect(mockImageToVideoCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          ratio: '16:9',
          callbackUrl: 'https://myapp.com/webhook/runway',
        }),
      );
    });
  });

  describe('checkStatus', () => {
    it('should map PENDING to queued', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({ status: 'PENDING', progress: 0 });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('queued');
    });

    it('should map RUNNING to processing with progress', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({ status: 'RUNNING', progress: 0.5 });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('processing');
      expect(status.progress).toBe(0.5);
    });

    it('should map SUCCEEDED to completed', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({ status: 'SUCCEEDED' });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('completed');
    });

    it('should map FAILED to failed with error message', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({
        status: 'FAILED',
        failure: 'Content policy violation',
      });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('failed');
      expect(status.error).toBe('Content policy violation');
    });

    it('should map THROTTLED to processing', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({ status: 'THROTTLED' });

      const status = await adapter.checkStatus('task-123');
      expect(status.status).toBe('processing');
    });
  });

  describe('getResult', () => {
    it('should return completed result with video URL', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({
        status: 'SUCCEEDED',
        output: ['https://runway.ai/video/output.mp4'],
      });

      const result = await adapter.getResult('task-123');
      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBe('https://runway.ai/video/output.mp4');
      expect(result.externalId).toBe('task-123');
    });

    it('should return failed for failed tasks', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({
        status: 'FAILED',
        failure: 'Generation failed',
      });

      const result = await adapter.getResult('task-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Generation failed');
    });

    it('should throw ProviderError for incomplete tasks', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({ status: 'RUNNING' });

      await expect(adapter.getResult('task-123')).rejects.toThrow(ProviderError);
    });
  });

  describe('waitForResult', () => {
    it('should poll and return completed result', async () => {
      mockTasksRetrieve
        .mockResolvedValueOnce({ status: 'PENDING', progress: 0 })
        .mockResolvedValueOnce({ status: 'RUNNING', progress: 0.5 })
        .mockResolvedValueOnce({ status: 'SUCCEEDED' })
        .mockResolvedValueOnce({ status: 'SUCCEEDED', output: ['https://runway.ai/video.mp4'] });

      const onProgress = vi.fn();

      const result = await adapter.waitForResult('task-123', {
        intervalMs: 10,
        maxAttempts: 10,
        onProgress,
      });

      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBe('https://runway.ai/video.mp4');
      expect(onProgress).toHaveBeenCalledTimes(3);
    });

    it('should return failed result when task fails', async () => {
      mockTasksRetrieve.mockResolvedValueOnce({
        status: 'FAILED',
        failure: 'Content violation',
      });

      const result = await adapter.waitForResult('task-123', {
        intervalMs: 10,
        maxAttempts: 5,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Content violation');
    });

    it('should throw ProviderTimeoutError when max attempts exceeded', async () => {
      mockTasksRetrieve.mockResolvedValue({ status: 'RUNNING', progress: 0.1 });

      await expect(
        adapter.waitForResult('task-123', { intervalMs: 10, maxAttempts: 3 }),
      ).rejects.toThrow(ProviderTimeoutError);
    });
  });

  describe('error handling', () => {
    it('should translate rate limit errors to ProviderRateLimitError', async () => {
      mockImageToVideoCreate.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded',
      });

      await expect(
        adapter.submit({
          prompt: 'test',
          model: 'gen4_turbo',
          startFrameUrl: 'https://example.com/frame.jpg',
          duration: 5,
        }),
      ).rejects.toThrow(ProviderRateLimitError);
    });

    it('should translate server errors to retryable ProviderError', async () => {
      mockImageToVideoCreate.mockRejectedValueOnce({
        status: 500,
        message: 'Internal server error',
      });

      try {
        await adapter.submit({
          prompt: 'test',
          model: 'gen4_turbo',
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
      mockImageToVideoCreate.mockRejectedValueOnce({
        status: 401,
        message: 'Invalid API key',
      });

      try {
        await adapter.submit({
          prompt: 'test',
          model: 'gen4_turbo',
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
