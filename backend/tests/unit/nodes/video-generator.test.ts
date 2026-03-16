import { describe, it, expect, beforeEach, vi } from 'vitest';

import { VideoGeneratorHandler } from '../../../src/modules/nodes/handlers/video-generator.handler.js';
import { ProviderRegistry } from '../../../src/providers/provider.registry.js';
import type { ExecutionContext } from '../../../src/modules/nodes/node.types.js';
import { createMockVideoAdapter } from '../../helpers/mock-providers.js';

// ── Test helpers ───────────────────────────────────────────────────────

function createContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    executionId: 'exec-001',
    workflowId: 'wf-001',
    projectId: 'proj-001',
    userId: 'user-001',
    nodeId: 'node-vidgen',
    ...overrides,
  };
}

function createRegistryWithMockAdapter() {
  const mockAdapter = createMockVideoAdapter();
  const registry = new ProviderRegistry();
  registry.register(mockAdapter as never);
  return { mockAdapter, registry };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('VideoGeneratorHandler', () => {
  let handler: VideoGeneratorHandler;

  beforeEach(() => {
    handler = new VideoGeneratorHandler();
  });

  // ── Identity ────────────────────────────────────────────────────────

  it('should have nodeType video-generator', () => {
    expect(handler.nodeType).toBe('video-generator');
  });

  it('should not be a fan-out node', () => {
    expect(handler.isFanOut()).toBe(false);
  });

  // ── Port schema ─────────────────────────────────────────────────────

  describe('getPortSchema', () => {
    it('should define frames, images, and text input ports', () => {
      const schema = handler.getPortSchema();

      expect(schema.inputs).toHaveLength(3);
      expect(schema.inputs).toEqual([
        { id: 'frames', dataType: 'frame', required: false },
        { id: 'images', dataType: 'image', required: false },
        { id: 'text', dataType: 'text', required: false },
      ]);
    });

    it('should define a single video output port', () => {
      const schema = handler.getPortSchema();

      expect(schema.outputs).toHaveLength(1);
      expect(schema.outputs[0]).toEqual({ id: 'video', dataType: 'video' });
    });
  });

  // ── validateConfig ──────────────────────────────────────────────────

  describe('validateConfig', () => {
    it('should accept config with a string provider', () => {
      const result = handler.validateConfig({ provider: 'runway' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config with missing provider', () => {
      const result = handler.validateConfig({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video generation provider is required');
    });

    it('should reject config with non-string provider', () => {
      const result = handler.validateConfig({ provider: 123 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video generation provider is required');
    });

    it('should reject config with empty string provider', () => {
      const result = handler.validateConfig({ provider: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Video generation provider is required');
    });

    it('should accept config with extra fields alongside provider', () => {
      const result = handler.validateConfig({
        provider: 'kling',
        model: 'v1',
        duration: 10,
        prompt: 'A sweeping aerial shot',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ── validateInput ───────────────────────────────────────────────────

  describe('validateInput', () => {
    it('should accept empty input (all ports optional)', () => {
      const result = handler.validateInput({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept input with images array', () => {
      const result = handler.validateInput({
        images: ['https://example.com/img-1.png', 'https://example.com/img-2.png'],
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept input with frames array', () => {
      const result = handler.validateInput({
        frames: ['https://example.com/frame-1.png'],
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept input with text', () => {
      const result = handler.validateInput({ text: 'Smooth camera pan across a lake' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept input with all ports provided', () => {
      const result = handler.validateInput({
        frames: ['https://example.com/frame-1.png'],
        images: ['https://example.com/img-1.png'],
        text: 'Cinematic transition',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ── execute ─────────────────────────────────────────────────────────

  describe('execute', () => {
    it('should call adapter.submit with startFrameUrl and endFrameUrl from images', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video', model: 'mock-vid-model' },
      });

      const input = {
        images: [
          'https://mock-storage.test/start-frame.png',
          'https://mock-storage.test/end-frame.png',
        ],
      };

      await handler.execute(input, { provider: 'mock-video' }, context);

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          startFrameUrl: 'https://mock-storage.test/start-frame.png',
          endFrameUrl: 'https://mock-storage.test/end-frame.png',
        }),
      );
    });

    it('should call adapter.submit with only startFrameUrl for single image', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video', model: 'mock-vid-model' },
      });

      const input = {
        images: ['https://mock-storage.test/single-frame.png'],
      };

      await handler.execute(input, { provider: 'mock-video' }, context);

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          startFrameUrl: 'https://mock-storage.test/single-frame.png',
        }),
      );
      // endFrameUrl should be undefined when only one image provided
      const submitCallArg = mockAdapter.submit.mock.calls[0][0];
      expect(submitCallArg.endFrameUrl).toBeUndefined();
    });

    it('should prefer frames over images for frame URLs', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      const input = {
        frames: ['https://mock-storage.test/frame-start.png', 'https://mock-storage.test/frame-end.png'],
        images: ['https://mock-storage.test/img-start.png', 'https://mock-storage.test/img-end.png'],
      };

      await handler.execute(input, { provider: 'mock-video' }, context);

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          startFrameUrl: 'https://mock-storage.test/frame-start.png',
          endFrameUrl: 'https://mock-storage.test/frame-end.png',
        }),
      );
    });

    it('should call adapter.waitForResult with correct polling params', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video' },
        context,
      );

      expect(mockAdapter.waitForResult).toHaveBeenCalledWith('mock-ext-id-001', {
        intervalMs: 5000,
        maxAttempts: 60,
      });
    });

    it('should return video URL from provider result', async () => {
      const { registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      const output = await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video' },
        context,
      );

      expect(output).toEqual({ video: 'https://mock-storage.test/video-1.mp4' });
    });

    it('should pass prompt from text input to adapter.submit', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      const input = {
        text: 'Dramatic zoom into a cityscape at sunset',
        images: ['https://mock-storage.test/city.png'],
      };

      await handler.execute(input, { provider: 'mock-video' }, context);

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Dramatic zoom into a cityscape at sunset',
        }),
      );
    });

    it('should fall back to config.prompt when no text input', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video', prompt: 'Config-level prompt' },
        context,
      );

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Config-level prompt',
        }),
      );
    });

    it('should use default prompt when no text input or config prompt', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video' },
        context,
      );

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Generate a smooth video transition',
        }),
      );
    });

    it('should pass model from providerConfig to adapter.submit', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video', model: 'gen-3-alpha' },
      });

      await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video' },
        context,
      );

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gen-3-alpha',
        }),
      );
    });

    it('should pass duration from config to adapter.submit', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video', duration: 10 },
        context,
      );

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 10,
        }),
      );
    });

    it('should default duration to 5 when not configured', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video' },
        context,
      );

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 5,
        }),
      );
    });

    it('should pass callbackUrl from config to adapter.submit', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video', callbackUrl: 'https://api.test/webhooks/runway' },
        context,
      );

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          callbackUrl: 'https://api.test/webhooks/runway',
        }),
      );
    });

    it('should return empty string for video when result has no videoUrl', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      mockAdapter.waitForResult.mockResolvedValue({
        status: 'completed',
        externalId: 'mock-ext-id-001',
        videoUrl: undefined,
        duration: 5,
      } as never);

      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      const output = await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'mock-video' },
        context,
      );

      expect(output).toEqual({ video: '' });
    });

    // ── Error scenarios ─────────────────────────────────────────────

    it('should throw when no provider registry is set', async () => {
      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await expect(
        handler.execute(
          { images: ['https://mock-storage.test/frame.png'] },
          { provider: 'mock-video' },
          context,
        ),
      ).rejects.toThrow('Video generation provider not configured');
    });

    it('should throw when providerConfig is missing and config.provider is empty', async () => {
      const { registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({ providerConfig: undefined });

      await expect(
        handler.execute(
          { images: ['https://mock-storage.test/frame.png'] },
          { provider: '' },
          context,
        ),
      ).rejects.toThrow('Video generation provider not configured');
    });

    it('should throw when providerConfig is missing and no config.provider', async () => {
      const { registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({ providerConfig: undefined });

      await expect(
        handler.execute({ images: ['https://mock-storage.test/frame.png'] }, {}, context),
      ).rejects.toThrow('Video generation provider not configured');
    });

    it('should throw when video generation fails with a specific error', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      mockAdapter.waitForResult.mockResolvedValue({
        status: 'failed',
        error: 'Content moderation rejected',
        externalId: 'mock-ext-id-001',
      } as never);

      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await expect(
        handler.execute(
          { images: ['https://mock-storage.test/frame.png'] },
          { provider: 'mock-video' },
          context,
        ),
      ).rejects.toThrow('Video generation failed: Content moderation rejected');
    });

    it('should throw with unknown error when video generation fails without error message', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      mockAdapter.waitForResult.mockResolvedValue({
        status: 'failed',
        externalId: 'mock-ext-id-001',
      } as never);

      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await expect(
        handler.execute(
          { images: ['https://mock-storage.test/frame.png'] },
          { provider: 'mock-video' },
          context,
        ),
      ).rejects.toThrow('Video generation failed: Unknown error');
    });

    it('should use providerConfig.provider over config.provider', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await handler.execute(
        { images: ['https://mock-storage.test/frame.png'] },
        { provider: 'different-provider' },
        context,
      );

      // The mock-video adapter was resolved and called, not different-provider
      expect(mockAdapter.submit).toHaveBeenCalled();
    });

    it('should handle empty images and frames gracefully', async () => {
      const { mockAdapter, registry } = createRegistryWithMockAdapter();
      handler.setProviderRegistry(registry);

      const context = createContext({
        providerConfig: { provider: 'mock-video' },
      });

      await handler.execute({}, { provider: 'mock-video' }, context);

      expect(mockAdapter.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          startFrameUrl: '',
        }),
      );
    });
  });
});
