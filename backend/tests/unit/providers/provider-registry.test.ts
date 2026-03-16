import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../../src/providers/provider.registry.js';
import type { IAIProvider } from '../../../src/providers/provider.interface.js';
import type { ITextAnalysisProvider } from '../../../src/providers/text-analysis/text-analysis.interface.js';
import type { IImageGenerationProvider } from '../../../src/providers/image-generation/image-generation.interface.js';
import type { IVideoGenerationProvider } from '../../../src/providers/video-generation/video-generation.interface.js';
import type { ProviderModel } from '../../../src/providers/provider.types.js';

function createMockTextProvider(slug = 'mock-text'): ITextAnalysisProvider {
  return {
    slug,
    displayName: 'Mock Text',
    category: 'text-analysis',
    validateCredentials: async () => true,
    listModels: async (): Promise<ProviderModel[]> => [{ id: 'model-1', name: 'Model 1' }],
    isWebhookBased: () => false,
    analyzeScript: async () => ({ title: '', genre: '', tone: '', totalScenes: 0, characters: [], themes: [], summary: '' }),
    extractCharacters: async () => ({ characters: [] }),
    splitScenes: async () => ({ scenes: [] }),
    generateImagePrompt: async () => ({ prompt: '', negativePrompt: '', suggestedWidth: 1024, suggestedHeight: 1024 }),
  };
}

function createMockImageProvider(slug = 'mock-image'): IImageGenerationProvider {
  return {
    slug,
    displayName: 'Mock Image',
    category: 'image-generation',
    validateCredentials: async () => true,
    listModels: async (): Promise<ProviderModel[]> => [{ id: 'img-model-1', name: 'Img Model 1' }],
    isWebhookBased: () => false,
    generate: async () => ({ status: 'completed' as const, images: [] }),
  };
}

function createMockVideoProvider(slug = 'mock-video'): IVideoGenerationProvider {
  return {
    slug,
    displayName: 'Mock Video',
    category: 'video-generation',
    validateCredentials: async () => true,
    listModels: async (): Promise<ProviderModel[]> => [{ id: 'vid-model-1', name: 'Vid Model 1' }],
    isWebhookBased: () => true,
    submit: async () => ({ externalId: 'ext-1', status: 'queued' as const, estimatedWaitMs: 5000 }),
    checkStatus: async () => ({ status: 'processing' as const }),
    getResult: async () => ({ status: 'completed' as const, externalId: 'ext-1', videoUrl: 'https://example.com/video.mp4' }),
    waitForResult: async () => ({ status: 'completed' as const, externalId: 'ext-1', videoUrl: 'https://example.com/video.mp4' }),
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('register', () => {
    it('should register a text analysis provider', () => {
      const provider = createMockTextProvider();
      registry.register(provider);

      const adapter = registry.getTextAdapter('mock-text');
      expect(adapter.slug).toBe('mock-text');
    });

    it('should register an image generation provider', () => {
      const provider = createMockImageProvider();
      registry.register(provider);

      const adapter = registry.getImageAdapter('mock-image');
      expect(adapter.slug).toBe('mock-image');
    });

    it('should register a video generation provider', () => {
      const provider = createMockVideoProvider();
      registry.register(provider);

      const adapter = registry.getVideoAdapter('mock-video');
      expect(adapter.slug).toBe('mock-video');
    });
  });

  describe('getTextAdapter', () => {
    it('should throw NotFoundError for unknown slug', () => {
      expect(() => registry.getTextAdapter('nonexistent')).toThrow(/not found/);
    });
  });

  describe('getImageAdapter', () => {
    it('should throw NotFoundError for unknown slug', () => {
      expect(() => registry.getImageAdapter('nonexistent')).toThrow(/not found/);
    });
  });

  describe('getVideoAdapter', () => {
    it('should throw NotFoundError for unknown slug', () => {
      expect(() => registry.getVideoAdapter('nonexistent')).toThrow(/not found/);
    });
  });

  describe('listByCategory', () => {
    it('should list all text providers', () => {
      registry.register(createMockTextProvider('text-a'));
      registry.register(createMockTextProvider('text-b'));

      const providers = registry.listByCategory('text-analysis');
      expect(providers).toHaveLength(2);
    });

    it('should return empty array for category with no providers', () => {
      const providers = registry.listByCategory('image-generation');
      expect(providers).toHaveLength(0);
    });
  });

  describe('listAll', () => {
    it('should list all registered providers across categories', () => {
      registry.register(createMockTextProvider());
      registry.register(createMockImageProvider());
      registry.register(createMockVideoProvider());

      const all = registry.listAll();
      expect(all).toHaveLength(3);
    });
  });

  describe('listCategories', () => {
    it('should return grouped providers by category', () => {
      registry.register(createMockTextProvider());
      registry.register(createMockImageProvider());
      registry.register(createMockVideoProvider());

      const categories = registry.listCategories();
      expect(categories).toHaveLength(3);

      const textCat = categories.find((c) => c.category === 'text-analysis');
      expect(textCat?.providers).toHaveLength(1);
      expect(textCat?.providers[0].slug).toBe('mock-text');
    });

    it('should show empty providers array for categories with no registrations', () => {
      registry.register(createMockTextProvider());

      const categories = registry.listCategories();
      const imageCat = categories.find((c) => c.category === 'image-generation');
      expect(imageCat?.providers).toHaveLength(0);
    });
  });
});
