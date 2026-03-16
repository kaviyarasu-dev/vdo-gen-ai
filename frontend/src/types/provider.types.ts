export type ProviderCategory = 'text-analysis' | 'image-generation' | 'video-generation';

export type ModelParameter = {
  key: string;
  label: string;
  type: 'number' | 'string' | 'select' | 'boolean' | 'slider' | 'textarea';
  default: unknown;
  description?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
};

export type AIModel = {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  parameters?: ModelParameter[];
};

export type AIProvider = {
  slug: string;
  displayName: string;
  category: ProviderCategory;
  models: AIModel[];
  isConfigured: boolean;
};

export type ProviderApiKeyStatus = 'valid' | 'invalid' | 'not_set';

export type ProviderApiKeyEntry = {
  provider: string;
  displayName: string;
  category: ProviderCategory;
  maskedKey: string | null;
  status: ProviderApiKeyStatus;
};

export type DefaultProviderPreferences = {
  'text-analysis': { provider: string | null; model: string | null };
  'image-generation': { provider: string | null; model: string | null };
  'video-generation': { provider: string | null; model: string | null };
};

/** Maps provider slugs to node-registry-compatible categories */
export const PROVIDER_CATEGORY_MAP: Record<string, ProviderCategory> = {
  openai: 'text-analysis',
  anthropic: 'text-analysis',
  google: 'text-analysis',
  stability: 'image-generation',
  midjourney: 'image-generation',
  fal: 'image-generation',
  ideogram: 'image-generation',
  kie: 'image-generation',
  runway: 'video-generation',
  pika: 'video-generation',
  kling: 'video-generation',
  luma: 'video-generation',
};

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI',
  stability: 'Stability AI',
  midjourney: 'Midjourney',
  fal: 'FAL AI',
  ideogram: 'Ideogram',
  kie: 'KIE',
  runway: 'Runway',
  pika: 'Pika',
  kling: 'Kling',
  luma: 'Luma',
};
