export type ProviderCategory = 'text-analysis' | 'image-generation' | 'video-generation';

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  maxResolution?: { width: number; height: number };
  maxDuration?: number;
}

// ── Text Analysis Types ──

export interface ScriptAnalysisInput {
  script: string;
  model?: string;
}

export interface ScriptAnalysisOutput {
  title: string;
  genre: string;
  tone: string;
  totalScenes: number;
  characters: { name: string; description: string }[];
  themes: string[];
  summary: string;
}

export interface CharacterExtractionInput {
  script: string;
  model?: string;
}

export interface CharacterExtractionOutput {
  characters: {
    name: string;
    description: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    appearance: string;
    personality: string;
  }[];
}

export interface SceneSplitInput {
  script: string;
  analysis?: ScriptAnalysisOutput;
  model?: string;
}

export interface SceneSplitOutput {
  scenes: {
    sceneNumber: number;
    title: string;
    description: string;
    setting: string;
    mood: string;
    characters: string[];
    startFrameDescription: string;
    endFrameDescription: string;
    estimatedDuration: number;
  }[];
}

export interface ImagePromptInput {
  sceneDescription: string;
  characters: { name: string; appearance: string }[];
  style?: string;
  model?: string;
}

export interface ImagePromptOutput {
  prompt: string;
  negativePrompt: string;
  suggestedWidth: number;
  suggestedHeight: number;
}

// ── Image Generation Types ──

export interface ImageGenerationInput {
  prompt: string;
  negativePrompt?: string;
  model: string;
  width: number;
  height: number;
  referenceImages?: { url: string; weight?: number }[];
  seed?: number;
  numImages?: number;
  params?: Record<string, unknown>;
}

export interface ImageGenerationResult {
  status: 'completed' | 'pending' | 'failed';
  externalId?: string;
  images?: { url: string; width: number; height: number; contentType: string }[];
  error?: string;
  estimatedWaitMs?: number;
}

export type GenerationStatus = {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
};

// ── Video Generation Types ──

export interface VideoGenerationInput {
  prompt: string;
  model: string;
  startFrameUrl: string;
  endFrameUrl?: string;
  duration: number;
  aspectRatio?: string;
  callbackUrl?: string;
  params?: Record<string, unknown>;
}

export interface VideoSubmissionResult {
  externalId: string;
  status: 'queued' | 'processing';
  estimatedWaitMs: number;
}

export interface VideoGenerationStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface VideoGenerationResult {
  status: 'completed' | 'failed';
  externalId: string;
  videoUrl?: string;
  duration?: number;
  error?: string;
}

export interface PollOptions {
  intervalMs?: number;
  maxAttempts?: number;
  onProgress?: (status: VideoGenerationStatus) => void;
}
