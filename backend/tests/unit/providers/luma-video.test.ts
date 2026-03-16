import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { LumaVideoAdapter } from '../../../src/providers/video-generation/luma-video.adapter.js';
import { ProviderError, ProviderRateLimitError, ProviderTimeoutError } from '../../../src/providers/provider.errors.js';

// Mock the lumaai module
const mockGenerationsCreate = vi.fn();
const mockGenerationsGet = vi.fn();

vi.mock('lumaai', () => {
  class MockLumaAI {
    generations = { create: mockGenerationsCreate, get: mockGenerationsGet };
  }
  return { default: MockLumaAI };
});

describe('LumaVideoAdapter', () => {
  let adapter: LumaVideoAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new LumaVideoAdapter('luma-test-key', 'webhook-secret');
  });

  describe('metadata', () => {
    it('should have correct slug, displayName, and category', () => {
      expect(adapter.slug).toBe('luma');
      expect(adapter.displayName).toBe('Luma');
      expect(adapter.category).toBe('video-generation');
    });

    it('should be webhook-based', () => {
      expect(adapter.isWebhookBased()).toBe(true);
    });

    it('should return webhook signature header', () => {
      expect(adapter.getWebhookSignatureHeader()).toBe('x-luma-signature');
    });
  });

  describe('listModels', () => {
    it('should return available models', async () => {
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models[0].id).toBe('ray-2');
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
      mockGenerationsCreate.mockResolvedValueOnce({
        id: 'luma-gen-123',
        state: 'queued',
      });

      const result = await adapter.submit({
        prompt: 'A hero walks through a forest',
        model: 'ray-2',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 5,
      });

      expect(result.externalId).toBe('luma-gen-123');
      expect(result.status).toBe('queued');
      expect(result.estimatedWaitMs).toBe(120_000);

      expect(mockGenerationsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'ray-2',
          prompt: 'A hero walks through a forest',
          keyframes: {
            frame0: { type: 'image', url: 'https://example.com/frame.jpg' },
          },
          duration: 5,
        }),
      );
    });

    it('should return processing status when state is dreaming', async () => {
      mockGenerationsCreate.mockResolvedValueOnce({
        id: 'luma-gen-456',
        state: 'dreaming',
      });

      const result = await adapter.submit({
        prompt: 'A sunset scene',
        model: 'ray-2',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 10,
      });

      expect(result.status).toBe('processing');
    });

    it('should include end frame URL when provided', async () => {
      mockGenerationsCreate.mockResolvedValueOnce({
        id: 'luma-gen-789',
        state: 'queued',
      });

      await adapter.submit({
        prompt: 'A transition scene',
        model: 'ray-2',
        startFrameUrl: 'https://example.com/start.jpg',
        endFrameUrl: 'https://example.com/end.jpg',
        duration: 5,
      });

      expect(mockGenerationsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          keyframes: {
            frame0: { type: 'image', url: 'https://example.com/start.jpg' },
            frame1: { type: 'image', url: 'https://example.com/end.jpg' },
          },
        }),
      );
    });

    it('should include callback URL and aspect ratio when provided', async () => {
      mockGenerationsCreate.mockResolvedValueOnce({
        id: 'luma-gen-abc',
        state: 'queued',
      });

      await adapter.submit({
        prompt: 'A scene',
        model: 'ray-2',
        startFrameUrl: 'https://example.com/frame.jpg',
        duration: 5,
        aspectRatio: '16:9',
        callbackUrl: 'https://myapp.com/webhook/luma',
      });

      expect(mockGenerationsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          aspect_ratio: '16:9',
          callback_url: 'https://myapp.com/webhook/luma',
        }),
      );
    });

    it('should handle API errors on submit', async () => {
      mockGenerationsCreate.mockRejectedValueOnce({
        status: 400,
        message: 'Bad request',
      });

      await expect(
        adapter.submit({
          prompt: 'test',
          model: 'ray-2',
          startFrameUrl: 'https://example.com/frame.jpg',
          duration: 5,
        }),
      ).rejects.toThrow(ProviderError);
    });
  });

  describe('checkStatus', () => {
    it('should map queued to queued', async () => {
      mockGenerationsGet.mockResolvedValueOnce({ id: 'gen-123', state: 'queued' });

      const status = await adapter.checkStatus('gen-123');
      expect(status.status).toBe('queued');
    });

    it('should map dreaming to processing', async () => {
      mockGenerationsGet.mockResolvedValueOnce({ id: 'gen-123', state: 'dreaming' });

      const status = await adapter.checkStatus('gen-123');
      expect(status.status).toBe('processing');
    });

    it('should map completed to completed', async () => {
      mockGenerationsGet.mockResolvedValueOnce({ id: 'gen-123', state: 'completed' });

      const status = await adapter.checkStatus('gen-123');
      expect(status.status).toBe('completed');
    });

    it('should map failed to failed with error', async () => {
      mockGenerationsGet.mockResolvedValueOnce({
        id: 'gen-123',
        state: 'failed',
        failure_reason: 'Content violation detected',
      });

      const status = await adapter.checkStatus('gen-123');
      expect(status.status).toBe('failed');
      expect(status.error).toBe('Content violation detected');
    });

    it('should handle API errors during status check', async () => {
      mockGenerationsGet.mockRejectedValueOnce({
        status: 500,
        message: 'Internal error',
      });

      await expect(adapter.checkStatus('gen-123')).rejects.toThrow(ProviderError);
    });
  });

  describe('getResult', () => {
    it('should return completed result with video URL', async () => {
      mockGenerationsGet.mockResolvedValueOnce({
        id: 'gen-123',
        state: 'completed',
        assets: {
          video: 'https://luma.ai/video/output.mp4',
        },
      });

      const result = await adapter.getResult('gen-123');
      expect(result.status).toBe('completed');
      expect(result.externalId).toBe('gen-123');
      expect(result.videoUrl).toBe('https://luma.ai/video/output.mp4');
    });

    it('should return failed for failed generations', async () => {
      mockGenerationsGet.mockResolvedValueOnce({
        id: 'gen-123',
        state: 'failed',
        failure_reason: 'Generation failed due to content policy',
      });

      const result = await adapter.getResult('gen-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Generation failed due to content policy');
    });

    it('should throw ProviderError for incomplete generations', async () => {
      mockGenerationsGet.mockResolvedValueOnce({
        id: 'gen-123',
        state: 'dreaming',
      });

      await expect(adapter.getResult('gen-123')).rejects.toThrow(ProviderError);
    });

    it('should return failed when no video URL in completed generation', async () => {
      mockGenerationsGet.mockResolvedValueOnce({
        id: 'gen-123',
        state: 'completed',
        assets: {},
      });

      const result = await adapter.getResult('gen-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('No output URL in completed generation');
    });

    it('should return failed when assets is missing', async () => {
      mockGenerationsGet.mockResolvedValueOnce({
        id: 'gen-123',
        state: 'completed',
      });

      const result = await adapter.getResult('gen-123');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('No output URL in completed generation');
    });
  });

  describe('waitForResult', () => {
    it('should poll and return completed result', async () => {
      mockGenerationsGet
        .mockResolvedValueOnce({ id: 'gen-123', state: 'queued' })
        .mockResolvedValueOnce({ id: 'gen-123', state: 'dreaming' })
        .mockResolvedValueOnce({ id: 'gen-123', state: 'completed' })
        .mockResolvedValueOnce({
          id: 'gen-123',
          state: 'completed',
          assets: { video: 'https://luma.ai/video.mp4' },
        });

      const onProgress = vi.fn();

      const result = await adapter.waitForResult('gen-123', {
        intervalMs: 10,
        maxAttempts: 10,
        onProgress,
      });

      expect(result.status).toBe('completed');
      expect(result.videoUrl).toBe('https://luma.ai/video.mp4');
      expect(onProgress).toHaveBeenCalledTimes(3);
    });

    it('should return failed result when generation fails', async () => {
      mockGenerationsGet.mockResolvedValueOnce({
        id: 'gen-123',
        state: 'failed',
        failure_reason: 'Content violation',
      });

      const result = await adapter.waitForResult('gen-123', {
        intervalMs: 10,
        maxAttempts: 5,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Content violation');
    });

    it('should throw ProviderTimeoutError when max attempts exceeded', async () => {
      mockGenerationsGet.mockResolvedValue({ id: 'gen-123', state: 'dreaming' });

      await expect(
        adapter.waitForResult('gen-123', { intervalMs: 10, maxAttempts: 3 }),
      ).rejects.toThrow(ProviderTimeoutError);
    });
  });

  describe('error handling', () => {
    it('should translate rate limit errors to ProviderRateLimitError', async () => {
      mockGenerationsCreate.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded',
      });

      await expect(
        adapter.submit({
          prompt: 'test',
          model: 'ray-2',
          startFrameUrl: 'https://example.com/frame.jpg',
          duration: 5,
        }),
      ).rejects.toThrow(ProviderRateLimitError);
    });

    it('should translate server errors to retryable ProviderError', async () => {
      mockGenerationsCreate.mockRejectedValueOnce({
        status: 500,
        message: 'Internal server error',
      });

      try {
        await adapter.submit({
          prompt: 'test',
          model: 'ray-2',
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
      mockGenerationsCreate.mockRejectedValueOnce({
        status: 401,
        message: 'Invalid API key',
      });

      try {
        await adapter.submit({
          prompt: 'test',
          model: 'ray-2',
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
