import type { Config } from '../config/index.js';
import { logger } from '../common/utils/logger.js';
import { ProviderRegistry } from './provider.registry.js';
import { OpenAITextAdapter } from './text-analysis/openai-text.adapter.js';
import { AnthropicTextAdapter } from './text-analysis/anthropic-text.adapter.js';
import { FalImageAdapter } from './image-generation/fal-image.adapter.js';
import { StabilityImageAdapter } from './image-generation/stability-image.adapter.js';
import { DalleImageAdapter } from './image-generation/dalle-image.adapter.js';
import { IdeogramImageAdapter } from './image-generation/ideogram-image.adapter.js';
import { KieImageAdapter } from './image-generation/kie-image.adapter.js';
import { RunwayVideoAdapter } from './video-generation/runway-video.adapter.js';
import { KlingVideoAdapter } from './video-generation/kling-video.adapter.js';
import { PikaVideoAdapter } from './video-generation/pika-video.adapter.js';
import { LumaVideoAdapter } from './video-generation/luma-video.adapter.js';

export function createProviderRegistry(config: Config): ProviderRegistry {
  const registry = new ProviderRegistry();

  // ── Text Analysis ──

  if (config.OPENAI_API_KEY) {
    registry.register(new OpenAITextAdapter(config.OPENAI_API_KEY));
    logger.info('Registered OpenAI text-analysis provider');
  } else {
    logger.warn('OPENAI_API_KEY not set — OpenAI provider unavailable');
  }

  if (config.ANTHROPIC_API_KEY) {
    registry.register(new AnthropicTextAdapter(config.ANTHROPIC_API_KEY));
    logger.info('Registered Anthropic text-analysis provider');
  } else {
    logger.warn('ANTHROPIC_API_KEY not set — Anthropic provider unavailable');
  }

  // ── Image Generation ──

  if (config.FAL_API_KEY) {
    registry.register(new FalImageAdapter(config.FAL_API_KEY));
    logger.info('Registered FAL AI image-generation provider');
  } else {
    logger.warn('FAL_API_KEY not set — FAL AI provider unavailable');
  }

  if (config.STABILITY_API_KEY) {
    registry.register(new StabilityImageAdapter(config.STABILITY_API_KEY));
    logger.info('Registered Stability AI image-generation provider');
  } else {
    logger.warn('STABILITY_API_KEY not set — Stability AI provider unavailable');
  }

  if (config.OPENAI_API_KEY) {
    registry.register(new DalleImageAdapter(config.OPENAI_API_KEY));
    logger.info('Registered DALL-E image-generation provider');
  }

  if (config.IDEOGRAM_API_KEY) {
    registry.register(new IdeogramImageAdapter(config.IDEOGRAM_API_KEY));
    logger.info('Registered Ideogram image-generation provider');
  } else {
    logger.warn('IDEOGRAM_API_KEY not set — Ideogram provider unavailable');
  }

  if (config.KIE_API_KEY) {
    registry.register(new KieImageAdapter(config.KIE_API_KEY, config.KIE_BASE_URL));
    logger.info('Registered KIE AI image-generation provider');
  } else {
    logger.warn('KIE_API_KEY not set — KIE AI provider unavailable');
  }

  // ── Video Generation ──

  if (config.RUNWAY_API_KEY) {
    registry.register(new RunwayVideoAdapter(config.RUNWAY_API_KEY, config.RUNWAY_WEBHOOK_SECRET));
    logger.info('Registered Runway video-generation provider');
  } else {
    logger.warn('RUNWAY_API_KEY not set — Runway provider unavailable');
  }

  if (config.KLING_API_KEY) {
    registry.register(new KlingVideoAdapter(config.KLING_API_KEY, config.KLING_WEBHOOK_SECRET));
    logger.info('Registered Kling video-generation provider');
  } else {
    logger.warn('KLING_API_KEY not set — Kling provider unavailable');
  }

  if (config.PIKA_API_KEY) {
    registry.register(new PikaVideoAdapter(config.PIKA_API_KEY, config.PIKA_WEBHOOK_SECRET));
    logger.info('Registered Pika video-generation provider');
  } else {
    logger.warn('PIKA_API_KEY not set — Pika provider unavailable');
  }

  if (config.LUMA_API_KEY) {
    registry.register(new LumaVideoAdapter(config.LUMA_API_KEY, config.LUMA_WEBHOOK_SECRET));
    logger.info('Registered Luma video-generation provider');
  } else {
    logger.warn('LUMA_API_KEY not set — Luma provider unavailable');
  }

  return registry;
}
