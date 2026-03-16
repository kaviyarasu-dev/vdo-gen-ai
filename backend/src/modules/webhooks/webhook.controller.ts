import type { FastifyRequest, FastifyReply } from 'fastify';

import { logger } from '../../common/utils/logger.js';
import type { WebhookService } from './webhook.service.js';

interface WebhookParams {
  provider: string;
}

export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Handle an inbound webhook from an AI provider.
   *
   * Always responds with 200 so the provider does not retry unnecessarily.
   * Errors during processing are logged but never surfaced to the caller.
   */
  async handleWebhook(
    request: FastifyRequest<{ Params: WebhookParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { provider } = request.params;

    try {
      // Obtain the raw body as a Buffer for signature verification.
      // Fastify stores it on request.rawBody when the custom content-type
      // parser is registered, otherwise fall back to the parsed body.
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody
        ?? Buffer.from(JSON.stringify(request.body));

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value[0] ?? '';
        }
      }

      const webhookPayload = await this.webhookService.processWebhook(
        provider,
        rawBody,
        headers,
      );

      if (webhookPayload) {
        logger.info(
          {
            provider,
            externalId: webhookPayload.externalId,
            status: webhookPayload.status,
          },
          'Webhook processed successfully',
        );
      }
    } catch (error) {
      // Log the failure but always return 200 to the provider.
      logger.error(
        { err: error, provider },
        'Failed to process webhook — acknowledging anyway',
      );
    }

    reply.status(200).send({ received: true });
  }
}
