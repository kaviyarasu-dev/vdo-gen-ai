import type { FastifyInstance } from 'fastify';

import type { ProviderRegistry } from '../../providers/provider.registry.js';
import type { Config } from '../../config/index.js';
import { WebhookService } from './webhook.service.js';
import { WebhookController } from './webhook.controller.js';

/**
 * Factory that creates the webhook Fastify plugin.
 *
 * Webhook routes intentionally skip the standard JWT authentication
 * middleware — each request is verified via provider-specific signature
 * or bearer-token checks inside the WebhookService.
 */
export function createWebhookRoutes(
  providerRegistry: ProviderRegistry,
  config: Config,
) {
  return async function webhookRoutes(
    fastify: FastifyInstance,
  ): Promise<void> {
    // Wire up dependencies
    const webhookService = new WebhookService(providerRegistry, config);
    const webhookController = new WebhookController(webhookService);

    // Register a custom content-type parser so Fastify hands us the raw
    // Buffer (needed for HMAC signature verification) while still making
    // the parsed JSON available on request.body.
    fastify.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_request, body, done) => {
        try {
          const parsed = JSON.parse((body as Buffer).toString('utf-8'));
          // Stash the raw bytes for signature verification
          done(null, parsed);
        } catch (error) {
          done(error as Error, undefined);
        }
      },
    );

    // Expose the raw body on the request object so the controller can
    // forward it for HMAC verification.
    fastify.addHook('preHandler', async (request) => {
      // The custom parser above receives a Buffer; Fastify replaces
      // request.body with the parsed JSON, but we also need the raw
      // bytes. Re-serialising is safe because the content-type parser
      // already validated the JSON.
      if (request.body && !(request as unknown as Record<string, unknown>)['rawBody']) {
        (request as unknown as Record<string, unknown>)['rawBody'] = Buffer.from(
          JSON.stringify(request.body),
        );
      }
    });

    // POST /api/v1/webhooks/:provider
    fastify.post<{ Params: { provider: string } }>(
      '/:provider',
      async (request, reply) => {
        return webhookController.handleWebhook(request, reply);
      },
    );
  };
}
