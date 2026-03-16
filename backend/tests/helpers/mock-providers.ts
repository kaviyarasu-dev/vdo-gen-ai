import { vi } from 'vitest';
import type { ProviderRegistry } from '../../src/providers/provider.registry.js';
import type { ITextAnalysisProvider } from '../../src/providers/text-analysis/text-analysis.interface.js';
import type { IImageGenerationProvider } from '../../src/providers/image-generation/image-generation.interface.js';
import type { IVideoGenerationProvider } from '../../src/providers/video-generation/video-generation.interface.js';

type MockTextAdapter = {
  [K in keyof ITextAnalysisProvider]: ITextAnalysisProvider[K] extends (...args: infer A) => infer R
    ? ReturnType<typeof vi.fn<(...args: A) => R>>
    : ITextAnalysisProvider[K];
};

type MockImageAdapter = {
  [K in keyof IImageGenerationProvider]: IImageGenerationProvider[K] extends (...args: infer A) => infer R
    ? ReturnType<typeof vi.fn<(...args: A) => R>>
    : IImageGenerationProvider[K];
};

type MockVideoAdapter = {
  [K in keyof IVideoGenerationProvider]: IVideoGenerationProvider[K] extends (...args: infer A) => infer R
    ? ReturnType<typeof vi.fn<(...args: A) => R>>
    : IVideoGenerationProvider[K];
};

export function createMockTextAdapter(): MockTextAdapter {
  return {
    slug: 'mock-text',
    displayName: 'Mock Text Provider',
    category: 'text-analysis' as const,
    isWebhookBased: vi.fn().mockReturnValue(false),
    validateCredentials: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([
      { id: 'mock-model', name: 'Mock Model', capabilities: ['script-analysis'] },
    ]),
    analyzeScript: vi.fn().mockResolvedValue({
      title: 'Test Script',
      genre: 'Drama',
      tone: 'Serious',
      totalScenes: 3,
      characters: [{ name: 'Hero', description: 'The main character' }],
      themes: ['courage'],
      summary: 'A test script summary',
    }),
    extractCharacters: vi.fn().mockResolvedValue({
      characters: [
        {
          name: 'Hero',
          description: 'The main character',
          role: 'protagonist',
          appearance: 'Tall and strong',
          personality: 'Brave',
        },
      ],
    }),
    splitScenes: vi.fn().mockResolvedValue({
      scenes: [
        {
          sceneNumber: 1,
          title: 'Opening',
          description: 'The hero appears',
          setting: 'A village',
          mood: 'peaceful',
          characters: ['Hero'],
          startFrameDescription: 'Wide shot of a village',
          endFrameDescription: 'Close-up of the hero',
          estimatedDuration: 10,
        },
        {
          sceneNumber: 2,
          title: 'The Journey',
          description: 'The hero sets off',
          setting: 'A forest',
          mood: 'adventurous',
          characters: ['Hero'],
          startFrameDescription: 'The hero walking into a forest',
          endFrameDescription: 'The hero reaching a clearing',
          estimatedDuration: 15,
        },
      ],
    }),
    generateImagePrompt: vi.fn().mockResolvedValue({
      prompt: 'A brave hero standing in a sunlit village, cinematic',
      negativePrompt: 'blurry, low quality',
      suggestedWidth: 1280,
      suggestedHeight: 720,
    }),
  };
}

export function createMockImageAdapter(): MockImageAdapter {
  return {
    slug: 'mock-image',
    displayName: 'Mock Image Provider',
    category: 'image-generation' as const,
    isWebhookBased: vi.fn().mockReturnValue(false),
    validateCredentials: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([
      { id: 'mock-img-model', name: 'Mock Image Model', capabilities: ['image-generation'] },
    ]),
    generate: vi.fn().mockResolvedValue({
      status: 'completed',
      images: [
        { url: 'https://mock-storage.test/image-1.png', width: 1280, height: 720, contentType: 'image/png' },
        { url: 'https://mock-storage.test/image-2.png', width: 1280, height: 720, contentType: 'image/png' },
      ],
    }),
  };
}

export function createMockVideoAdapter(): MockVideoAdapter {
  return {
    slug: 'mock-video',
    displayName: 'Mock Video Provider',
    category: 'video-generation' as const,
    isWebhookBased: vi.fn().mockReturnValue(false),
    validateCredentials: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([
      { id: 'mock-vid-model', name: 'Mock Video Model', capabilities: ['video-generation'] },
    ]),
    submit: vi.fn().mockResolvedValue({
      externalId: 'mock-ext-id-001',
      status: 'queued',
      estimatedWaitMs: 30_000,
    }),
    checkStatus: vi.fn().mockResolvedValue({
      status: 'completed',
      progress: 100,
    }),
    getResult: vi.fn().mockResolvedValue({
      status: 'completed',
      externalId: 'mock-ext-id-001',
      videoUrl: 'https://mock-storage.test/video-1.mp4',
      duration: 10,
    }),
    waitForResult: vi.fn().mockResolvedValue({
      status: 'completed',
      externalId: 'mock-ext-id-001',
      videoUrl: 'https://mock-storage.test/video-1.mp4',
      duration: 10,
    }),
  };
}

export function createMockProviderRegistry(): Partial<ProviderRegistry> {
  const textAdapter = createMockTextAdapter();
  const imageAdapter = createMockImageAdapter();
  const videoAdapter = createMockVideoAdapter();

  return {
    getTextAdapter: vi.fn().mockReturnValue(textAdapter),
    getImageAdapter: vi.fn().mockReturnValue(imageAdapter),
    getVideoAdapter: vi.fn().mockReturnValue(videoAdapter),
    listByCategory: vi.fn().mockReturnValue([]),
    listAll: vi.fn().mockReturnValue([]),
    listCategories: vi.fn().mockReturnValue([
      {
        category: 'text-analysis',
        providers: [{ slug: 'mock-text', displayName: 'Mock Text Provider' }],
      },
      {
        category: 'image-generation',
        providers: [{ slug: 'mock-image', displayName: 'Mock Image Provider' }],
      },
      {
        category: 'video-generation',
        providers: [{ slug: 'mock-video', displayName: 'Mock Video Provider' }],
      },
    ]),
  };
}
