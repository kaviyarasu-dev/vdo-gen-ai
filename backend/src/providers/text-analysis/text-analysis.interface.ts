import type { IAIProvider } from '../provider.interface.js';
import type {
  ScriptAnalysisInput,
  ScriptAnalysisOutput,
  CharacterExtractionInput,
  CharacterExtractionOutput,
  SceneSplitInput,
  SceneSplitOutput,
  ImagePromptInput,
  ImagePromptOutput,
} from '../provider.types.js';

export interface ITextAnalysisProvider extends IAIProvider {
  analyzeScript(input: ScriptAnalysisInput): Promise<ScriptAnalysisOutput>;
  extractCharacters(input: CharacterExtractionInput): Promise<CharacterExtractionOutput>;
  splitScenes(input: SceneSplitInput): Promise<SceneSplitOutput>;
  generateImagePrompt(input: ImagePromptInput): Promise<ImagePromptOutput>;
}
