import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';
import { ProviderRegistry } from '../../../providers/provider.registry.js';

interface ImageGeneratorInput {
  scenes?: Record<string, unknown>[];
  characters?: Record<string, unknown>[];
  text?: string;
}

interface ImageGeneratorOutput {
  images: string[];
}

export class ImageGeneratorHandler extends BaseNodeHandler<ImageGeneratorInput, ImageGeneratorOutput> {
  readonly nodeType: NodeType = 'image-generator';

  private providerRegistry: ProviderRegistry | null = null;

  setProviderRegistry(registry: ProviderRegistry): void {
    this.providerRegistry = registry;
  }

  validateConfig(config: Record<string, unknown>): ValidationResult {
    if (!config.provider || typeof config.provider !== 'string') {
      return this.createInvalidResult('Image generation provider is required');
    }
    return this.createValidResult();
  }

  validateInput(_input: ImageGeneratorInput): ValidationResult {
    return this.createValidResult();
  }

  async execute(
    input: ImageGeneratorInput,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<ImageGeneratorOutput> {
    const providerSlug = context.providerConfig?.provider ?? (config.provider as string);
    if (!providerSlug || !this.providerRegistry) {
      throw new Error('Image generation provider not configured');
    }

    const adapter = this.providerRegistry.getImageAdapter(providerSlug);

    // Build prompt from scene description or text
    const prompt = this.buildPrompt(input);
    const model = context.providerConfig?.model ?? (config.model as string) ?? '';
    const width = (config.width as number) ?? 1280;
    const height = (config.height as number) ?? 720;

    const result = await adapter.generate({
      prompt,
      model,
      width,
      height,
      negativePrompt: config.negativePrompt as string | undefined,
      numImages: (config.numImages as number) ?? 2,
    });

    if (result.status === 'failed') {
      throw new Error(`Image generation failed: ${result.error ?? 'Unknown error'}`);
    }

    const imageUrls = result.images?.map((img) => img.url) ?? [];

    return { images: imageUrls };
  }

  private buildPrompt(input: ImageGeneratorInput): string {
    if (input.text) return input.text;

    const scene = input.scenes?.[0];
    if (scene) {
      const parts: string[] = [];
      if (scene.startFrameDescription) parts.push(scene.startFrameDescription as string);
      if (scene.setting) parts.push(`Setting: ${scene.setting as string}`);
      if (scene.mood) parts.push(`Mood: ${scene.mood as string}`);
      return parts.join('. ');
    }

    return 'A cinematic scene';
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [
        { id: 'scenes', dataType: 'scenes', required: false },
        { id: 'characters', dataType: 'characters', required: false },
        { id: 'text', dataType: 'text', required: false },
      ],
      outputs: [{ id: 'images', dataType: 'image' }],
    };
  }
}
