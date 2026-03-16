import { describe, it, expect, beforeEach, vi } from 'vitest';

import { VideoCombinerHandler } from '../../../src/modules/nodes/handlers/video-combiner.handler.js';
import type { ExecutionContext } from '../../../src/modules/nodes/node.types.js';

// ── Mock fluent-ffmpeg to avoid actual binary dependency in tests ──

vi.mock('fluent-ffmpeg', () => {
  const mockRun = vi.fn();
  const mockFfmpegInstance = {
    input: vi.fn().mockReturnThis(),
    inputOptions: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    on: vi.fn(function (this: Record<string, unknown>, event: string, cb: (...args: unknown[]) => void) {
      // Store callbacks so we can invoke them
      if (event === 'end') {
        (this as Record<string, unknown>)._onEnd = cb;
      }
      if (event === 'error') {
        (this as Record<string, unknown>)._onError = cb;
      }
      return this;
    }),
    run: vi.fn(function (this: Record<string, (...args: unknown[]) => void>) {
      // Simulate immediate completion
      if (this._onEnd) {
        this._onEnd();
      }
    }),
  };

  return {
    default: vi.fn(() => mockFfmpegInstance),
  };
});

// ── Mock node:fs/promises and node:os to avoid filesystem operations ──

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/common/utils/id-generator.js', () => ({
  generateId: vi.fn().mockReturnValue('abc12345'),
}));

// ── Test helpers ───────────────────────────────────────────────────────

function createContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    executionId: 'exec-001',
    workflowId: 'wf-001',
    projectId: 'proj-001',
    userId: 'user-001',
    nodeId: 'node-combiner',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('VideoCombinerHandler', () => {
  let handler: VideoCombinerHandler;

  beforeEach(() => {
    handler = new VideoCombinerHandler();
  });

  it('should have nodeType video-combiner', () => {
    expect(handler.nodeType).toBe('video-combiner');
  });

  it('should validate input requires videos array', () => {
    const valid = handler.validateInput({
      videos: ['/path/to/video1.mp4', '/path/to/video2.mp4'],
    });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toHaveLength(0);
  });

  it('should reject missing videos input', () => {
    const result = handler.validateInput({} as never);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Videos input is required');
  });

  it('should reject null videos', () => {
    const result = handler.validateInput({ videos: null } as never);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Videos input is required');
  });

  it('should reject non-array videos', () => {
    const result = handler.validateInput({ videos: 'not-an-array' } as never);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Videos input is required');
  });

  it('should reject empty videos array', () => {
    const result = handler.validateInput({ videos: [] });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Videos input is required');
  });

  it('should return single video without combining', async () => {
    const context = createContext();
    const singleVideoPath = '/tmp/vdo-gen/exec-001/scene-0.mp4';

    const output = await handler.execute(
      { videos: [singleVideoPath] },
      {},
      context,
    );

    expect(output.video).toBe(singleVideoPath);
  });

  it('should combine multiple videos using ffmpeg', async () => {
    const context = createContext();
    const videoPaths = [
      '/tmp/vdo-gen/exec-001/scene-0.mp4',
      '/tmp/vdo-gen/exec-001/scene-1.mp4',
      '/tmp/vdo-gen/exec-001/scene-2.mp4',
    ];

    const output = await handler.execute(
      { videos: videoPaths },
      {},
      context,
    );

    // Output path is built from tmpdir + executionId + generated ID
    expect(output.video).toContain('combined-abc12345.mp4');
    expect(output.video).toContain('exec-001');
  });

  it('should have correct port schema', () => {
    const schema = handler.getPortSchema();

    expect(schema.inputs).toHaveLength(1);
    expect(schema.inputs[0]).toEqual({
      id: 'videos',
      dataType: 'video',
      required: true,
      maxConnections: -1,
    });

    expect(schema.outputs).toHaveLength(1);
    expect(schema.outputs[0]).toEqual({
      id: 'video',
      dataType: 'video',
    });
  });

  it('should not be a fan-out node', () => {
    expect(handler.isFanOut()).toBe(false);
  });

  it('should always validate config as valid (no config required)', () => {
    const result = handler.validateConfig({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
