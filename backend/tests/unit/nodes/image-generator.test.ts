import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ImageGeneratorHandler } from '../../../src/modules/nodes/handlers/image-generator.handler.js';
import { ProviderRegistry } from '../../../src/providers/provider.registry.js';
import type { ExecutionContext } from '../../../src/modules/nodes/node.types.js';
import { createMockImageAdapter } from '../../helpers/mock-providers.js';

// ── Test helpers ───────────────────────────────────────────────────────

function createContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    executionId: 'exec-001',
    workflowId: 'wf-001',
    projectId: 'proj-001',
    userId: 'user-001',
    nodeId: 'node-imggen',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('ImageGeneratorHandler', () => {
  let handler: ImageGeneratorHandler;

  beforeEach(() => {
    handler = new ImageGeneratorHandler();
  });

  it('should have nodeType image-generator', () => {
    expect(handler.nodeType).toBe('image-generator');
  });

  it('should validate config requires provider', () => {
    const valid = handler.validateConfig({ provider: 'fal' });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toHaveLength(0);
  });

  it('should reject config with missing provider', () => {
    const result = handler.validateConfig({});
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Image generation provider is required');
  });

  it('should reject config with non-string provider', () => {
    const result = handler.validateConfig({ provider: 42 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Image generation provider is required');
  });

  it('should always validate input as valid (optional inputs)', () => {
    const result = handler.validateInput({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should build prompt from scene data', async () => {
    const mockAdapter = createMockImageAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image', model: 'mock-img-model' },
    });

    const input = {
      scenes: [
        {
          startFrameDescription: 'Wide shot of a medieval castle',
          setting: 'Mountain top',
          mood: 'epic',
        },
      ],
    };

    await handler.execute(input, { provider: 'mock-image' }, context);

    // The adapter's generate was called with the prompt built from scene data
    expect(mockAdapter.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Wide shot of a medieval castle. Setting: Mountain top. Mood: epic',
      }),
    );
  });

  it('should build prompt from text input', async () => {
    const mockAdapter = createMockImageAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image' },
    });

    const input = { text: 'A beautiful sunset over the ocean' };

    await handler.execute(input, { provider: 'mock-image' }, context);

    expect(mockAdapter.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'A beautiful sunset over the ocean',
      }),
    );
  });

  it('should use default prompt when no input', async () => {
    const mockAdapter = createMockImageAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image' },
    });

    await handler.execute({}, { provider: 'mock-image' }, context);

    expect(mockAdapter.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'A cinematic scene',
      }),
    );
  });

  it('should return image URLs from successful generation', async () => {
    const mockAdapter = createMockImageAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image' },
    });

    const output = await handler.execute(
      { text: 'A hero in battle' },
      { provider: 'mock-image' },
      context,
    );

    expect(output.images).toEqual([
      'https://mock-storage.test/image-1.png',
      'https://mock-storage.test/image-2.png',
    ]);
  });

  it('should throw on failed generation', async () => {
    const mockAdapter = createMockImageAdapter();
    mockAdapter.generate.mockResolvedValue({
      status: 'failed',
      error: 'Content policy violation',
      images: [],
    } as never);

    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image' },
    });

    await expect(
      handler.execute({ text: 'test' }, { provider: 'mock-image' }, context),
    ).rejects.toThrow('Image generation failed: Content policy violation');
  });

  it('should throw on failed generation with unknown error', async () => {
    const mockAdapter = createMockImageAdapter();
    mockAdapter.generate.mockResolvedValue({
      status: 'failed',
      images: [],
    } as never);

    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image' },
    });

    await expect(
      handler.execute({ text: 'test' }, { provider: 'mock-image' }, context),
    ).rejects.toThrow('Image generation failed: Unknown error');
  });

  it('should throw when no provider configured', async () => {
    const context = createContext({ providerConfig: undefined });

    await expect(
      handler.execute({}, { provider: '' }, context),
    ).rejects.toThrow('Image generation provider not configured');
  });

  it('should use config width, height, and numImages', async () => {
    const mockAdapter = createMockImageAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image', model: 'custom-model' },
    });

    const config = {
      provider: 'mock-image',
      width: 512,
      height: 512,
      numImages: 4,
      negativePrompt: 'blurry, ugly',
    };

    await handler.execute({ text: 'test prompt' }, config, context);

    expect(mockAdapter.generate).toHaveBeenCalledWith({
      prompt: 'test prompt',
      model: 'custom-model',
      width: 512,
      height: 512,
      negativePrompt: 'blurry, ugly',
      numImages: 4,
    });
  });

  it('should have correct port schema', () => {
    const schema = handler.getPortSchema();

    expect(schema.inputs).toHaveLength(3);
    expect(schema.inputs).toEqual([
      { id: 'scenes', dataType: 'scenes', required: false },
      { id: 'characters', dataType: 'characters', required: false },
      { id: 'text', dataType: 'text', required: false },
    ]);

    expect(schema.outputs).toHaveLength(1);
    expect(schema.outputs[0]).toEqual({
      id: 'images',
      dataType: 'image',
    });
  });

  it('should not be a fan-out node', () => {
    expect(handler.isFanOut()).toBe(false);
  });

  it('should prefer text input over scene data for prompt', async () => {
    const mockAdapter = createMockImageAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image' },
    });

    // Both text and scenes provided -- text takes priority
    const input = {
      text: 'Custom text prompt',
      scenes: [
        {
          startFrameDescription: 'Scene description',
          setting: 'Forest',
          mood: 'dark',
        },
      ],
    };

    await handler.execute(input, { provider: 'mock-image' }, context);

    expect(mockAdapter.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Custom text prompt',
      }),
    );
  });

  it('should build partial prompt when scene has only some fields', async () => {
    const mockAdapter = createMockImageAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-image' },
    });

    // Scene with only setting (no startFrameDescription, no mood)
    const input = {
      scenes: [{ setting: 'A dark alley' }],
    };

    await handler.execute(input, { provider: 'mock-image' }, context);

    expect(mockAdapter.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Setting: A dark alley',
      }),
    );
  });
});
