import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SceneSplitterHandler } from '../../../src/modules/nodes/handlers/scene-splitter.handler.js';
import { ProviderRegistry } from '../../../src/providers/provider.registry.js';
import type { ExecutionContext } from '../../../src/modules/nodes/node.types.js';
import { createMockTextAdapter } from '../../helpers/mock-providers.js';

// ── Test helpers ───────────────────────────────────────────────────────

function createContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    executionId: 'exec-001',
    workflowId: 'wf-001',
    projectId: 'proj-001',
    userId: 'user-001',
    nodeId: 'node-splitter',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('SceneSplitterHandler', () => {
  let handler: SceneSplitterHandler;

  beforeEach(() => {
    handler = new SceneSplitterHandler();
  });

  it('should have nodeType scene-splitter', () => {
    expect(handler.nodeType).toBe('scene-splitter');
  });

  it('should be a fan-out node', () => {
    expect(handler.isFanOut()).toBe(true);
  });

  it('should validate input requires script string', () => {
    const valid = handler.validateInput({ script: 'INT. HOUSE - DAY\nHero enters.' });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toHaveLength(0);
  });

  it('should reject missing script input', () => {
    const missingScript = handler.validateInput({} as never);
    expect(missingScript.isValid).toBe(false);
    expect(missingScript.errors).toContain('Script input is required');
  });

  it('should reject non-string script input', () => {
    const nonString = handler.validateInput({ script: 42 } as never);
    expect(nonString.isValid).toBe(false);
    expect(nonString.errors).toContain('Script input is required');
  });

  it('should always accept config (no config required)', () => {
    const result = handler.validateConfig({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should execute using text analysis provider', async () => {
    const mockTextAdapter = createMockTextAdapter();

    // Build a real ProviderRegistry and register the mock adapter
    const registry = new ProviderRegistry();
    registry.register(mockTextAdapter as never);

    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-text', model: 'mock-model' },
    });

    const input = { script: 'INT. HOUSE - DAY\nHero enters the room.' };
    const output = await handler.execute(input, {}, context);

    // The mock splitScenes returns 2 scenes
    expect(output.scenes).toHaveLength(2);
    expect(output.scenes[0]).toHaveProperty('sceneNumber', 1);
    expect(output.scenes[1]).toHaveProperty('sceneNumber', 2);

    // The adapter's splitScenes was called with the correct arguments
    expect(mockTextAdapter.splitScenes).toHaveBeenCalledWith({
      script: input.script,
      model: 'mock-model',
    });
  });

  it('should throw when no provider configured', async () => {
    // Do NOT set a provider registry
    const context = createContext({ providerConfig: undefined });
    const input = { script: 'INT. HOUSE - DAY\nHero enters the room.' };

    await expect(handler.execute(input, {}, context)).rejects.toThrow(
      'Text analysis provider not configured for scene-splitter',
    );
  });

  it('should throw when providerRegistry is set but no provider slug', async () => {
    const registry = new ProviderRegistry();
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: '' },
    });
    const input = { script: 'INT. HOUSE - DAY\nHero enters the room.' };

    await expect(handler.execute(input, {}, context)).rejects.toThrow(
      'Text analysis provider not configured for scene-splitter',
    );
  });

  it('should have correct port schema', () => {
    const schema = handler.getPortSchema();

    expect(schema.inputs).toHaveLength(2);
    expect(schema.inputs[0]).toEqual({
      id: 'script',
      dataType: 'script',
      required: true,
    });
    expect(schema.inputs[1]).toEqual({
      id: 'characters',
      dataType: 'characters',
      required: false,
    });

    expect(schema.outputs).toHaveLength(1);
    expect(schema.outputs[0]).toEqual({
      id: 'scenes',
      dataType: 'scenes',
    });
  });
});
