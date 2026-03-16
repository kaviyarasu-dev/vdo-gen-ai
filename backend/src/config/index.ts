import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z.string().url(),
  MONGODB_DB_NAME: z.string().default('vdo_gen'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_PATH: z.string().default('./uploads'),
  UPLOAD_MAX_FILE_SIZE: z.coerce.number().default(500 * 1024 * 1024),

  // AI Provider keys
  OPENAI_API_KEY: z.string().optional(),
  FAL_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  RUNWAY_WEBHOOK_SECRET: z.string().optional(),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),

  // Stability AI
  STABILITY_API_KEY: z.string().optional(),

  // DALL-E (reuses OPENAI_API_KEY)

  // Ideogram
  IDEOGRAM_API_KEY: z.string().optional(),

  // KIE AI
  KIE_API_KEY: z.string().optional(),
  KIE_BASE_URL: z.string().url().default('https://api.kie.ai/api/v1'),

  // Kling
  KLING_API_KEY: z.string().optional(),
  KLING_WEBHOOK_SECRET: z.string().optional(),

  // Pika
  PIKA_API_KEY: z.string().optional(),
  PIKA_WEBHOOK_SECRET: z.string().optional(),

  // Luma
  LUMA_API_KEY: z.string().optional(),
  LUMA_WEBHOOK_SECRET: z.string().optional(),

  // API key encryption
  PROVIDER_KEY_ENCRYPTION_SECRET: z.string().min(32).optional(),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error('Invalid environment configuration:');
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  return result.data;
}

export const config: Config = loadConfig();
