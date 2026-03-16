import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from './node.types.js';

export abstract class BaseNodeHandler<TInput = unknown, TOutput = unknown> {
  abstract readonly nodeType: NodeType;

  abstract validateConfig(config: Record<string, unknown>): ValidationResult;
  abstract validateInput(input: TInput): ValidationResult;
  abstract execute(
    input: TInput,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<TOutput>;
  abstract getPortSchema(): INodePortSchema;

  isFanOut(): boolean {
    return false;
  }

  protected createValidResult(): ValidationResult {
    return { isValid: true, errors: [] };
  }

  protected createInvalidResult(...errors: string[]): ValidationResult {
    return { isValid: false, errors };
  }
}
