import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';
import { ProviderRegistry } from '../../../providers/provider.registry.js';

interface SceneSplitterInput {
  script: string;
  characters?: Record<string, unknown>[];
}

interface SceneSplitterOutput {
  scenes: Record<string, unknown>[];
}

export class SceneSplitterHandler extends BaseNodeHandler<SceneSplitterInput, SceneSplitterOutput> {
  readonly nodeType: NodeType = 'scene-splitter';

  private providerRegistry: ProviderRegistry | null = null;

  setProviderRegistry(registry: ProviderRegistry): void {
    this.providerRegistry = registry;
  }

  override isFanOut(): boolean {
    return true;
  }

  validateConfig(_config: Record<string, unknown>): ValidationResult {
    return this.createValidResult();
  }

  validateInput(input: SceneSplitterInput): ValidationResult {
    if (!input.script || typeof input.script !== 'string') {
      return this.createInvalidResult('Script input is required');
    }
    return this.createValidResult();
  }

  async execute(
    input: SceneSplitterInput,
    _config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<SceneSplitterOutput> {
    const providerSlug = context.providerConfig?.provider;
    if (!providerSlug || !this.providerRegistry) {
      throw new Error('Text analysis provider not configured for scene-splitter');
    }

    const adapter = this.providerRegistry.getTextAdapter(providerSlug);
    const result = await adapter.splitScenes({
      script: input.script,
      model: context.providerConfig?.model,
    });

    return {
      scenes: result.scenes as unknown as Record<string, unknown>[],
    };
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [
        { id: 'script', dataType: 'script', required: true },
        { id: 'characters', dataType: 'characters', required: false },
      ],
      outputs: [{ id: 'scenes', dataType: 'scenes' }],
    };
  }
}
