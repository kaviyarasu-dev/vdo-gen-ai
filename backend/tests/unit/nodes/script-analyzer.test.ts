import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ScriptAnalyzerHandler } from '../../../src/modules/nodes/handlers/script-analyzer.handler.js';
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
    nodeId: 'node-analyzer',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('ScriptAnalyzerHandler', () => {
  let handler: ScriptAnalyzerHandler;

  beforeEach(() => {
    handler = new ScriptAnalyzerHandler();
  });

  // ── nodeType ────────────────────────────────────────────────────────

  it('test_nodeType_accessed_returnsScriptAnalyzer', () => {
    expect(handler.nodeType).toBe('script-analyzer');
  });

  // ── getPortSchema ──────────────────────────────────────────────────

  it('test_getPortSchema_called_returnsCorrectInputs', () => {
    const schema = handler.getPortSchema();

    expect(schema.inputs).toHaveLength(1);
    expect(schema.inputs[0]).toEqual({
      id: 'script',
      dataType: 'script',
      required: true,
    });
  });

  it('test_getPortSchema_called_returnsCorrectOutputs', () => {
    const schema = handler.getPortSchema();

    expect(schema.outputs).toHaveLength(2);
    expect(schema.outputs).toEqual([
      { id: 'analysis', dataType: 'text' },
      { id: 'script', dataType: 'script' },
    ]);
  });

  // ── validateConfig ─────────────────────────────────────────────────

  it('test_validateConfig_emptyConfig_returnsValid', () => {
    const result = handler.validateConfig({});

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('test_validateConfig_arbitraryProperties_returnsValid', () => {
    const result = handler.validateConfig({
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      extra: 'anything',
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ── validateInput ──────────────────────────────────────────────────

  it('test_validateInput_validScript_returnsValid', () => {
    const result = handler.validateInput({ script: 'INT. HOUSE - DAY\nHero enters the room.' });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('test_validateInput_emptyString_returnsInvalid', () => {
    const result = handler.validateInput({ script: '' });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Script input is required');
  });

  it('test_validateInput_missingScript_returnsInvalid', () => {
    const result = handler.validateInput({} as never);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Script input is required');
  });

  it('test_validateInput_nonStringScript_returnsInvalid', () => {
    const result = handler.validateInput({ script: 42 } as never);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Script input is required');
  });

  it('test_validateInput_nullScript_returnsInvalid', () => {
    const result = handler.validateInput({ script: null } as never);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Script input is required');
  });

  it('test_validateInput_undefinedScript_returnsInvalid', () => {
    const result = handler.validateInput({ script: undefined } as never);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Script input is required');
  });

  // ── isFanOut ───────────────────────────────────────────────────────

  it('test_isFanOut_called_returnsFalse', () => {
    expect(handler.isFanOut()).toBe(false);
  });

  // ── execute ────────────────────────────────────────────────────────

  it('test_execute_withMockProvider_callsAnalyzeScriptWithCorrectArgs', async () => {
    const mockAdapter = createMockTextAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-text', model: 'mock-model' },
    });

    const scriptText = 'INT. HOUSE - DAY\nHero enters the room and finds a letter.';

    await handler.execute({ script: scriptText }, {}, context);

    expect(mockAdapter.analyzeScript).toHaveBeenCalledOnce();
    expect(mockAdapter.analyzeScript).toHaveBeenCalledWith({
      script: scriptText,
      model: 'mock-model',
    });
  });

  it('test_execute_withMockProvider_returnsAnalysisAsJsonString', async () => {
    const mockAdapter = createMockTextAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-text', model: 'mock-model' },
    });

    const scriptText = 'INT. OFFICE - NIGHT\nDetective examines the evidence.';

    const output = await handler.execute({ script: scriptText }, {}, context);

    const expectedAnalysis = {
      title: 'Test Script',
      genre: 'Drama',
      tone: 'Serious',
      totalScenes: 3,
      characters: [{ name: 'Hero', description: 'The main character' }],
      themes: ['courage'],
      summary: 'A test script summary',
    };

    expect(output.analysis).toBe(JSON.stringify(expectedAnalysis));
    expect(JSON.parse(output.analysis)).toEqual(expectedAnalysis);
  });

  it('test_execute_withMockProvider_returnsOriginalScript', async () => {
    const mockAdapter = createMockTextAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-text' },
    });

    const scriptText = 'EXT. FOREST - DAWN\nBirds sing as the sun rises.';

    const output = await handler.execute({ script: scriptText }, {}, context);

    expect(output.script).toBe(scriptText);
  });

  it('test_execute_withoutModel_passesUndefinedModel', async () => {
    const mockAdapter = createMockTextAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: 'mock-text' },
    });

    const scriptText = 'INT. CAFE - AFTERNOON\nTwo friends meet.';

    await handler.execute({ script: scriptText }, {}, context);

    expect(mockAdapter.analyzeScript).toHaveBeenCalledWith({
      script: scriptText,
      model: undefined,
    });
  });

  it('test_execute_noProviderRegistrySet_throwsError', async () => {
    const context = createContext({
      providerConfig: { provider: 'openai', model: 'gpt-4o' },
    });

    await expect(
      handler.execute({ script: 'Some script' }, {}, context),
    ).rejects.toThrow('Text analysis provider not configured for script-analyzer');
  });

  it('test_execute_noProviderInContext_throwsError', async () => {
    const mockAdapter = createMockTextAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({ providerConfig: undefined });

    await expect(
      handler.execute({ script: 'Some script' }, {}, context),
    ).rejects.toThrow('Text analysis provider not configured for script-analyzer');
  });

  it('test_execute_emptyProviderSlug_throwsError', async () => {
    const mockAdapter = createMockTextAdapter();
    const registry = new ProviderRegistry();
    registry.register(mockAdapter as never);
    handler.setProviderRegistry(registry);

    const context = createContext({
      providerConfig: { provider: '' },
    });

    await expect(
      handler.execute({ script: 'Some script' }, {}, context),
    ).rejects.toThrow('Text analysis provider not configured for script-analyzer');
  });

  it('test_execute_bothRegistryAndProviderMissing_throwsError', async () => {
    const context = createContext({ providerConfig: undefined });

    await expect(
      handler.execute({ script: 'Some script' }, {}, context),
    ).rejects.toThrow('Text analysis provider not configured for script-analyzer');
  });
});
