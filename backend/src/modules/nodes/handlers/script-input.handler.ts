import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';

interface ScriptInputInput {
  // No inputs - this is a source node
}

interface ScriptInputOutput {
  script: string;
}

export class ScriptInputHandler extends BaseNodeHandler<ScriptInputInput, ScriptInputOutput> {
  readonly nodeType: NodeType = 'script-input';

  validateConfig(config: Record<string, unknown>): ValidationResult {
    if (!config.content || typeof config.content !== 'string') {
      return this.createInvalidResult('Script content is required');
    }
    if ((config.content as string).trim().length === 0) {
      return this.createInvalidResult('Script content cannot be empty');
    }
    return this.createValidResult();
  }

  validateInput(_input: ScriptInputInput): ValidationResult {
    return this.createValidResult();
  }

  async execute(
    _input: ScriptInputInput,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<ScriptInputOutput> {
    return { script: config.content as string };
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [],
      outputs: [{ id: 'script', dataType: 'script' }],
    };
  }
}
