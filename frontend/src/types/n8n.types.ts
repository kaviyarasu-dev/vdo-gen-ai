export type ImageResolution = '1K' | '2K' | '4K';
export type VideoModel = 'kling-2.6' | 'wan-2.6';
export type TransitionType = 'none' | 'crossfade' | 'fade';
export type OutputResolution = '720p' | '1080p' | '4k';

export type VideoGenerationConfig = {
  parallel_scenes: number;
  image_resolution: ImageResolution;
  video_model: VideoModel;
  transition_type: TransitionType;
  output_resolution: OutputResolution;
};

export type VideoGenerationPayload = {
  script: string;
  callback_url: string;
  config: VideoGenerationConfig;
};

export type VideoGenerationResponse = {
  success: boolean;
  message: string;
  execution_id: string;
  n8n_url: string;
  status_url: string;
};

export const IMAGE_RESOLUTION_OPTIONS: { value: ImageResolution; label: string }[] = [
  { value: '1K', label: '1K (1024px)' },
  { value: '2K', label: '2K (2048px)' },
  { value: '4K', label: '4K (4096px)' },
];

export const VIDEO_MODEL_OPTIONS: { value: VideoModel; label: string }[] = [
  { value: 'kling-2.6', label: 'Kling 2.6' },
  { value: 'wan-2.6', label: 'Wan 2.6' },
];

export const TRANSITION_TYPE_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fade', label: 'Fade' },
];

export const OUTPUT_RESOLUTION_OPTIONS: { value: OutputResolution; label: string }[] = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p (Full HD)' },
  { value: '4k', label: '4K (Ultra HD)' },
];

export const DEFAULT_CONFIG: VideoGenerationConfig = {
  parallel_scenes: 5,
  image_resolution: '2K',
  video_model: 'kling-2.6',
  transition_type: 'crossfade',
  output_resolution: '1080p',
};
