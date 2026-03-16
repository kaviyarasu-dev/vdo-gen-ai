import { NotFoundError } from '../common/errors/not-found-error.js';
import type { IAIProvider } from './provider.interface.js';
import type { ProviderCategory } from './provider.types.js';
import type { ITextAnalysisProvider } from './text-analysis/text-analysis.interface.js';
import type { IImageGenerationProvider } from './image-generation/image-generation.interface.js';
import type { IVideoGenerationProvider } from './video-generation/video-generation.interface.js';

export class ProviderRegistry {
  private textProviders = new Map<string, ITextAnalysisProvider>();
  private imageProviders = new Map<string, IImageGenerationProvider>();
  private videoProviders = new Map<string, IVideoGenerationProvider>();

  register(provider: IAIProvider): void {
    switch (provider.category) {
      case 'text-analysis':
        this.textProviders.set(provider.slug, provider as ITextAnalysisProvider);
        break;
      case 'image-generation':
        this.imageProviders.set(provider.slug, provider as IImageGenerationProvider);
        break;
      case 'video-generation':
        this.videoProviders.set(provider.slug, provider as IVideoGenerationProvider);
        break;
    }
  }

  getTextAdapter(slug: string): ITextAnalysisProvider {
    const provider = this.textProviders.get(slug);
    if (!provider) {
      throw new NotFoundError(`text-analysis provider '${slug}'`);
    }
    return provider;
  }

  getImageAdapter(slug: string): IImageGenerationProvider {
    const provider = this.imageProviders.get(slug);
    if (!provider) {
      throw new NotFoundError(`image-generation provider '${slug}'`);
    }
    return provider;
  }

  getVideoAdapter(slug: string): IVideoGenerationProvider {
    const provider = this.videoProviders.get(slug);
    if (!provider) {
      throw new NotFoundError(`video-generation provider '${slug}'`);
    }
    return provider;
  }

  listByCategory(category: ProviderCategory): IAIProvider[] {
    switch (category) {
      case 'text-analysis':
        return [...this.textProviders.values()];
      case 'image-generation':
        return [...this.imageProviders.values()];
      case 'video-generation':
        return [...this.videoProviders.values()];
    }
  }

  listAll(): IAIProvider[] {
    return [
      ...this.textProviders.values(),
      ...this.imageProviders.values(),
      ...this.videoProviders.values(),
    ];
  }

  listCategories(): { category: ProviderCategory; providers: { slug: string; displayName: string }[] }[] {
    const categories: ProviderCategory[] = ['text-analysis', 'image-generation', 'video-generation'];

    return categories.map((category) => ({
      category,
      providers: this.listByCategory(category).map((p) => ({
        slug: p.slug,
        displayName: p.displayName,
      })),
    }));
  }
}
