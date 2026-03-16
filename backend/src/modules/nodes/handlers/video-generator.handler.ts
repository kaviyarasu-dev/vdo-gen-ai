import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';
import { ProviderRegistry } from '../../../providers/provider.registry.js';

interface VideoGeneratorInput {
  frames?: string[];
  images?: string[];
  text?: string;
}

interface VideoGeneratorOutput {
  video: string;
}

export class VideoGeneratorHandler extends BaseNodeHandler<VideoGeneratorInput, VideoGeneratorOutput> {
  readonly nodeType: NodeType = 'video-generator';

  private providerRegistry: ProviderRegistry | null = null;

  setProviderRegistry(registry: ProviderRegistry): void {
    this.providerRegistry = registry;
  }

  validateConfig(config: Record<string, unknown>): ValidationResult {
    if (!config.provider || typeof config.provider !== 'string') {
      return this.createInvalidResult('Video generation provider is required');
    }
    return this.createValidResult();
  }

  validateInput(_input: VideoGeneratorInput): ValidationResult {
    return this.createValidResult();
  }

  async execute(
    input: VideoGeneratorInput,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<VideoGeneratorOutput> {
    const providerSlug = context.providerConfig?.provider ?? (config.provider as string);
    if (!providerSlug || !this.providerRegistry) {
      throw new Error('Video generation provider not configured');
    }

    const adapter = this.providerRegistry.getVideoAdapter(providerSlug);

    // Determine start frame from frames or images
    const startFrameUrl = input.frames?.[0] ?? input.images?.[0] ?? '';
    const endFrameUrl = input.frames?.[1] ?? input.images?.[1];
    const prompt = input.text ?? (config.prompt as string) ?? 'Generate a smooth video transition';
    const model = context.providerConfig?.model ?? (config.model as string) ?? '';
    const duration = (config.duration as number) ?? 5;

    // Submit to provider
    const submission = await adapter.submit({
      prompt,
      model,
      startFrameUrl,
      endFrameUrl,
      duration,
      callbackUrl: config.callbackUrl as string | undefined,
    });

    // Poll for result (webhook-based providers handled at worker level in future)
    const result = await adapter.waitForResult(submission.externalId, {
      intervalMs: 5000,
      maxAttempts: 60,
    });

    if (result.status === 'failed') {
      throw new Error(`Video generation failed: ${result.error ?? 'Unknown error'}`);
    }

    return { video: result.videoUrl ?? '' };
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [
        { id: 'frames', dataType: 'frame', required: false },
        { id: 'images', dataType: 'image', required: false },
        { id: 'text', dataType: 'text', required: false },
      ],
      outputs: [{ id: 'video', dataType: 'video' }],
    };
  }
}
