import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';
import { generateId } from '../../../common/utils/id-generator.js';

interface VideoCombinerInput {
  videos: string[];
}

interface VideoCombinerOutput {
  video: string;
}

export class VideoCombinerHandler extends BaseNodeHandler<VideoCombinerInput, VideoCombinerOutput> {
  readonly nodeType: NodeType = 'video-combiner';

  validateConfig(_config: Record<string, unknown>): ValidationResult {
    return this.createValidResult();
  }

  validateInput(input: VideoCombinerInput): ValidationResult {
    if (!input.videos || !Array.isArray(input.videos) || input.videos.length === 0) {
      return this.createInvalidResult('Videos input is required');
    }
    return this.createValidResult();
  }

  async execute(
    input: VideoCombinerInput,
    _config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<VideoCombinerOutput> {
    if (input.videos.length === 1) {
      return { video: input.videos[0] };
    }

    // Use fluent-ffmpeg to concatenate videos
    const ffmpeg = await import('fluent-ffmpeg');
    const FfmpegCommand = ffmpeg.default;

    const workDir = join(tmpdir(), 'vdo-gen', context.executionId);
    await mkdir(workDir, { recursive: true });

    // Write concat file list
    const concatFileContent = input.videos
      .map((videoPath) => `file '${videoPath}'`)
      .join('\n');
    const concatFilePath = join(workDir, 'concat.txt');
    await writeFile(concatFilePath, concatFileContent, 'utf-8');

    const outputPath = join(workDir, `combined-${generateId(8)}.mp4`);

    await new Promise<void>((resolve, reject) => {
      FfmpegCommand()
        .input(concatFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });

    // Clean up concat file
    await unlink(concatFilePath).catch(() => {});

    return { video: outputPath };
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [{ id: 'videos', dataType: 'video', required: true, maxConnections: -1 }],
      outputs: [{ id: 'video', dataType: 'video' }],
    };
  }
}
