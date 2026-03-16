import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';
import { ProviderRegistry } from '../../../providers/provider.registry.js';

interface CharacterExtractorInput {
  script: string;
}

interface CharacterExtractorOutput {
  characters: Record<string, unknown>[];
  script: string;
}

export class CharacterExtractorHandler extends BaseNodeHandler<CharacterExtractorInput, CharacterExtractorOutput> {
  readonly nodeType: NodeType = 'character-extractor';

  private providerRegistry: ProviderRegistry | null = null;

  setProviderRegistry(registry: ProviderRegistry): void {
    this.providerRegistry = registry;
  }

  validateConfig(_config: Record<string, unknown>): ValidationResult {
    return this.createValidResult();
  }

  validateInput(input: CharacterExtractorInput): ValidationResult {
    if (!input.script || typeof input.script !== 'string') {
      return this.createInvalidResult('Script input is required');
    }
    return this.createValidResult();
  }

  async execute(
    input: CharacterExtractorInput,
    _config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<CharacterExtractorOutput> {
    const providerSlug = context.providerConfig?.provider;
    if (!providerSlug || !this.providerRegistry) {
      throw new Error('Text analysis provider not configured for character-extractor');
    }

    const adapter = this.providerRegistry.getTextAdapter(providerSlug);
    const result = await adapter.extractCharacters({
      script: input.script,
      model: context.providerConfig?.model,
    });

    return {
      characters: result.characters as unknown as Record<string, unknown>[],
      script: input.script,
    };
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [{ id: 'script', dataType: 'script', required: true }],
      outputs: [
        { id: 'characters', dataType: 'characters' },
        { id: 'script', dataType: 'script' },
      ],
    };
  }
}
