import type { IAIProvider } from '../provider.interface.js';
import type {
  VideoGenerationInput,
  VideoSubmissionResult,
  VideoGenerationStatus,
  VideoGenerationResult,
  PollOptions,
} from '../provider.types.js';

export interface IVideoGenerationProvider extends IAIProvider {
  submit(input: VideoGenerationInput): Promise<VideoSubmissionResult>;
  checkStatus(externalId: string): Promise<VideoGenerationStatus>;
  getResult(externalId: string): Promise<VideoGenerationResult>;
  waitForResult(externalId: string, options?: PollOptions): Promise<VideoGenerationResult>;
}
