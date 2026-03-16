import type { IAIProvider } from '../provider.interface.js';
import type {
  ImageGenerationInput,
  ImageGenerationResult,
  GenerationStatus,
} from '../provider.types.js';

export interface IImageGenerationProvider extends IAIProvider {
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;
  checkStatus?(externalId: string): Promise<GenerationStatus>;
  getResult?(externalId: string): Promise<ImageGenerationResult>;
}
