import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { ValidationError } from '../common/errors/validation-error.js';
import type { ProviderRegistry } from './provider.registry.js';
import type { ProviderCategory } from './provider.types.js';

const VALID_CATEGORIES: ProviderCategory[] = ['text-analysis', 'image-generation', 'video-generation'];

const categoryParamsSchema = z.object({
  category: z.enum(['text-analysis', 'image-generation', 'video-generation']),
});

const modelParamsSchema = z.object({
  category: z.enum(['text-analysis', 'image-generation', 'video-generation']),
  provider: z.string().min(1),
});

export function createProviderRoutes(registry: ProviderRegistry) {
  return async function providerRoutes(app: FastifyInstance): Promise<void> {
    // GET /api/v1/providers — list all providers grouped by category
    app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
      const grouped = registry.listCategories();
      return reply.send({ providers: grouped });
    });

    // GET /api/v1/providers/:category — list providers for a category
    app.get('/:category', async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = categoryParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        throw new ValidationError(
          `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        );
      }

      const providers = registry.listByCategory(parsed.data.category).map((p) => ({
        slug: p.slug,
        displayName: p.displayName,
        category: p.category,
        isWebhookBased: p.isWebhookBased(),
      }));

      return reply.send({ category: parsed.data.category, providers });
    });

    // GET /api/v1/providers/:category/:provider/models — list models for a provider
    app.get('/:category/:provider/models', async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = modelParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        throw new ValidationError('Invalid category or provider parameter');
      }

      const { category, provider: slug } = parsed.data;
      const adapters = registry.listByCategory(category);
      const adapter = adapters.find((a) => a.slug === slug);

      if (!adapter) {
        throw new ValidationError(`Provider '${slug}' not found in category '${category}'`);
      }

      const models = await adapter.listModels();
      return reply.send({
        category,
        provider: slug,
        displayName: adapter.displayName,
        models,
      });
    });
  };
}
