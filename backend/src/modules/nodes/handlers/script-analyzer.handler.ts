import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';
import { ProviderRegistry } from '../../../providers/provider.registry.js';

interface ScriptAnalyzerInput {
  script: string;
}

interface ScriptAnalyzerOutput {
  analysis: string;
  script: string;
}

export class ScriptAnalyzerHandler extends BaseNodeHandler<ScriptAnalyzerInput, ScriptAnalyzerOutput> {
  readonly nodeType: NodeType = 'script-analyzer';

  private providerRegistry: ProviderRegistry | null = null;

  setProviderRegistry(registry: ProviderRegistry): void {
    this.providerRegistry = registry;
  }

  validateConfig(_config: Record<string, unknown>): ValidationResult {
    return this.createValidResult();
  }

  validateInput(input: ScriptAnalyzerInput): ValidationResult {
    if (!input.script || typeof input.script !== 'string') {
      return this.createInvalidResult('Script input is required');
    }
    return this.createValidResult();
  }

  async execute(
    input: ScriptAnalyzerInput,
    _config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<ScriptAnalyzerOutput> {
    const providerSlug = context.providerConfig?.provider;
    if (!providerSlug || !this.providerRegistry) {
      throw new Error('Text analysis provider not configured for script-analyzer');
    }

    const adapter = this.providerRegistry.getTextAdapter(providerSlug);
    const result = await adapter.analyzeScript({
      script: input.script,
      model: context.providerConfig?.model,
    });

    return {
      analysis: JSON.stringify(result),
      script: input.script,
    };
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [{ id: 'script', dataType: 'script', required: true }],
      outputs: [
        { id: 'analysis', dataType: 'text' },
        { id: 'script', dataType: 'script' },
      ],
    };
  }
}
