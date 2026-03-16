import type { BaseNodeHandler } from '../modules/nodes/base-node.handler.js';

/**
 * Validates that all required input ports have values.
 * Throws a descriptive error if any required inputs are missing.
 */
export function validateRequiredInputs(
  handler: BaseNodeHandler<unknown, unknown>,
  input: Record<string, unknown>,
  nodeType: string,
): void {
  const portSchema = handler.getPortSchema();
  const missingPorts: string[] = [];

  for (const port of portSchema.inputs) {
    if (port.required && (input[port.id] === undefined || input[port.id] === null)) {
      missingPorts.push(port.id);
    }
  }

  if (missingPorts.length > 0) {
    throw new Error(
      `Missing required input(s) for "${nodeType}": [${missingPorts.join(', ')}]. ` +
      `Ensure edges connect to these input ports.`,
    );
  }
}
