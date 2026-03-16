import { ScriptInputNode } from '@/components/nodes/ScriptInputNode';
import { ScriptAnalyzerNode } from '@/components/nodes/ScriptAnalyzerNode';
import { CharacterExtractorNode } from '@/components/nodes/CharacterExtractorNode';
import { SceneSplitterNode } from '@/components/nodes/SceneSplitterNode';
import { ImageGeneratorNode } from '@/components/nodes/ImageGeneratorNode';
import { FrameComposerNode } from '@/components/nodes/FrameComposerNode';
import { VideoGeneratorNode } from '@/components/nodes/VideoGeneratorNode';
import { VideoCombinerNode } from '@/components/nodes/VideoCombinerNode';
import { OutputNode } from '@/components/nodes/OutputNode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, React.ComponentType<any>> = {
  scriptInput: ScriptInputNode,
  scriptAnalyzer: ScriptAnalyzerNode,
  characterExtractor: CharacterExtractorNode,
  sceneSplitter: SceneSplitterNode,
  imageGenerator: ImageGeneratorNode,
  frameComposer: FrameComposerNode,
  videoGenerator: VideoGeneratorNode,
  videoCombiner: VideoCombinerNode,
  output: OutputNode,
};
