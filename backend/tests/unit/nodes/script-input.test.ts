import { describe, it, expect, beforeEach } from 'vitest';

import { ScriptInputHandler } from '../../../src/modules/nodes/handlers/script-input.handler.js';
import type { ExecutionContext } from '../../../src/modules/nodes/node.types.js';

// ── Test helpers ───────────────────────────────────────────────────────

function createContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    executionId: 'exec-001',
    workflowId: 'wf-001',
    projectId: 'proj-001',
    userId: 'user-001',
    nodeId: 'node-001',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('ScriptInputHandler', () => {
  let handler: ScriptInputHandler;

  beforeEach(() => {
    handler = new ScriptInputHandler();
  });

  it('should have nodeType script-input', () => {
    expect(handler.nodeType).toBe('script-input');
  });

  it('should return script port schema with no inputs', () => {
    const schema = handler.getPortSchema();

    expect(schema.inputs).toEqual([]);
    expect(schema.outputs).toHaveLength(1);
    expect(schema.outputs[0]).toEqual({
      id: 'script',
      dataType: 'script',
    });
  });

  it('should validate config with valid script', () => {
    const result = handler.validateConfig({ script: 'INT. HOUSE - DAY\nHero enters.' });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject config with missing script', () => {
    const result = handler.validateConfig({});

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Script content is required');
  });

  it('should reject config with non-string script', () => {
    const result = handler.validateConfig({ script: 42 });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Script content is required');
  });

  it('should reject config with empty string script', () => {
    const result = handler.validateConfig({ script: '   ' });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Script content cannot be empty');
  });

  it('should execute and return script from config', async () => {
    const scriptText = 'INT. HOUSE - DAY\nHero enters the room and sits down.';
    const context = createContext();

    const output = await handler.execute({} as never, { script: scriptText }, context);

    expect(output).toEqual({ script: scriptText });
  });

  it('should not be a fan-out node', () => {
    expect(handler.isFanOut()).toBe(false);
  });

  it('should always validate input as valid (source node)', () => {
    const result = handler.validateInput({} as never);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
