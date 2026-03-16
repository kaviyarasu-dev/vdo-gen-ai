import { BaseNodeHandler } from '../base-node.handler.js';
import type {
  NodeType,
  INodePortSchema,
  ValidationResult,
  ExecutionContext,
} from '../node.types.js';

interface FrameComposerInput {
  images: string[];
  text?: string;
}

interface FrameComposerOutput {
  frames: string[];
}

export class FrameComposerHandler extends BaseNodeHandler<FrameComposerInput, FrameComposerOutput> {
  readonly nodeType: NodeType = 'frame-composer';

  validateConfig(_config: Record<string, unknown>): ValidationResult {
    return this.createValidResult();
  }

  validateInput(input: FrameComposerInput): ValidationResult {
    if (!input.images || !Array.isArray(input.images) || input.images.length === 0) {
      return this.createInvalidResult('Images input is required');
    }
    return this.createValidResult();
  }

  async execute(
    input: FrameComposerInput,
    _config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<FrameComposerOutput> {
    // Frame composer takes generated images and designates them as start/end frames.
    // First image = start frame, last image = end frame (if multiple).
    // Additional compositing (overlays, text) can be added here in the future.
    const frames: string[] = [];

    if (input.images.length >= 2) {
      // Start frame and end frame
      frames.push(input.images[0]); // start frame
      frames.push(input.images[input.images.length - 1]); // end frame
    } else if (input.images.length === 1) {
      // Single image serves as start frame only
      frames.push(input.images[0]);
    }

    return { frames };
  }

  getPortSchema(): INodePortSchema {
    return {
      inputs: [
        { id: 'images', dataType: 'image', required: true },
        { id: 'text', dataType: 'text', required: false },
      ],
      outputs: [{ id: 'frames', dataType: 'frame' }],
    };
  }
}
