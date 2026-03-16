import type { NodeType, INodePortSchema } from './node.types.js';
import type { BaseNodeHandler } from './base-node.handler.js';
import { ScriptInputHandler } from './handlers/script-input.handler.js';
import { ScriptAnalyzerHandler } from './handlers/script-analyzer.handler.js';
import { CharacterExtractorHandler } from './handlers/character-extractor.handler.js';
import { SceneSplitterHandler } from './handlers/scene-splitter.handler.js';
import { ImageGeneratorHandler } from './handlers/image-generator.handler.js';
import { FrameComposerHandler } from './handlers/frame-composer.handler.js';
import { VideoGeneratorHandler } from './handlers/video-generator.handler.js';
import { VideoCombinerHandler } from './handlers/video-combiner.handler.js';
import { OutputHandler } from './handlers/output.handler.js';

export class NodeRegistry {
  private readonly handlers = new Map<NodeType, BaseNodeHandler>();

  constructor() {
    this.register(new ScriptInputHandler());
    this.register(new ScriptAnalyzerHandler());
    this.register(new CharacterExtractorHandler());
    this.register(new SceneSplitterHandler());
    this.register(new ImageGeneratorHandler());
    this.register(new FrameComposerHandler());
    this.register(new VideoGeneratorHandler());
    this.register(new VideoCombinerHandler());
    this.register(new OutputHandler());
  }

  private register(handler: BaseNodeHandler): void {
    this.handlers.set(handler.nodeType, handler);
  }

  getHandler(nodeType: NodeType): BaseNodeHandler {
    const handler = this.handlers.get(nodeType);
    if (!handler) {
      throw new Error(`No handler registered for node type: ${nodeType}`);
    }
    return handler;
  }

  getPortSchema(nodeType: NodeType): INodePortSchema {
    return this.getHandler(nodeType).getPortSchema();
  }

  isFanOut(nodeType: NodeType): boolean {
    return this.getHandler(nodeType).isFanOut();
  }

  hasHandler(nodeType: NodeType): boolean {
    return this.handlers.has(nodeType);
  }

  getRegisteredTypes(): NodeType[] {
    return Array.from(this.handlers.keys());
  }
}

// Singleton instance
let registryInstance: NodeRegistry | null = null;

export function getNodeRegistry(): NodeRegistry {
  if (!registryInstance) {
    registryInstance = new NodeRegistry();
  }
  return registryInstance;
}
