import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';
import type { IStorageAdapter } from '../../../storage/storage.interface.js';

interface OutputInput {
  video: string;
}

interface OutputOutput {
  video: string;
  storagePath?: string;
}

export class OutputHandler extends BaseNodeHandler<OutputInput, OutputOutput> {
  readonly nodeType: NodeType = 'output';

  private storageAdapter: IStorageAdapter | null = null;

  setStorageAdapter(adapter: IStorageAdapter): void {
    this.storageAdapter = adapter;
  }

  validateConfig(_config: Record<string, unknown>): ValidationResult {
    return this.createValidResult();
  }

  validateInput(input: OutputInput): ValidationResult {
    if (!input.video || typeof input.video !== 'string') {
      return this.createInvalidResult('Video input is required');
    }
    return this.createValidResult();
  }

  async execute(
    input: OutputInput,
    _config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<OutputOutput> {
    // If storage adapter is available and video is a local path, upload it
    if (this.storageAdapter && !input.video.startsWith('http')) {
      const filename = basename(input.video);
      const storagePath = `projects/${context.projectId}/executions/${context.executionId}/${filename}`;

      const fileBuffer = await readFile(input.video);
      const url = await this.storageAdapter.upload(fileBuffer, storagePath, 'video/mp4');

      return { video: url, storagePath };
    }

    return { video: input.video };
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [{ id: 'video', dataType: 'video', required: true }],
      outputs: [],
    };
  }
}
