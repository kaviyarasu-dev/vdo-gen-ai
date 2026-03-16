import { timingSafeEqual, createHmac } from 'node:crypto';

import { logger } from '../../common/utils/logger.js';
import { UnauthorizedError } from '../../common/errors/index.js';
import type { ProviderRegistry } from '../../providers/provider.registry.js';
import type { IAIProvider } from '../../providers/provider.interface.js';
import type { Config } from '../../config/index.js';
import WebhookEventModel from './webhook.model.js';
import type { WebhookPayload } from './webhook.types.js';

/**
 * Map of provider slugs to the config key holding their webhook secret.
 * Providers not listed here use bearer-token verification via the
 * Authorization header instead.
 */
const SIGNATURE_SECRET_KEYS: Record<string, keyof Config> = {
  runway: 'RUNWAY_WEBHOOK_SECRET',
  kling: 'KLING_WEBHOOK_SECRET',
  pika: 'PIKA_WEBHOOK_SECRET',
  luma: 'LUMA_WEBHOOK_SECRET',
};

/**
 * Providers that authenticate webhooks with a bearer token in the
 * Authorization header instead of an HMAC signature.
 */
const BEARER_TOKEN_PROVIDERS = new Set(['fal', 'ideogram', 'kie']);

export class WebhookService {
  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly config: Config,
  ) {}

  /**
   * Ingest a raw webhook payload from an AI provider.
   *
   * 1. Verify the request authenticity (signature or bearer token).
   * 2. Parse the raw payload into a normalised WebhookPayload.
   * 3. Guard against duplicate delivery (idempotency by provider + externalId).
   * 4. Persist the raw event for auditing and return the parsed payload for
   *    downstream processing (queue workers, execution engine, etc.).
   */
  async processWebhook(
    provider: string,
    rawPayload: Buffer,
    headers: Record<string, string>,
  ): Promise<WebhookPayload | null> {
    // --- 1. Verify authenticity ---
    this.verifyRequest(provider, rawPayload, headers);

    // --- 2. Parse raw payload ---
    const parsed: Record<string, unknown> = JSON.parse(rawPayload.toString('utf-8'));
    const webhookPayload = this.normalisePayload(provider, parsed);

    // --- 3. Idempotency check ---
    const existing = await WebhookEventModel.findOne({
      provider,
      externalId: webhookPayload.externalId,
    }).lean();

    if (existing?.processed) {
      logger.debug(
        { provider, externalId: webhookPayload.externalId },
        'Webhook event already processed — skipping',
      );
      return null;
    }

    // --- 4. Persist raw event ---
    if (existing) {
      // Event was stored before but not yet processed (e.g. previous attempt
      // failed). Update the payload in case the provider resent with changes.
      await WebhookEventModel.updateOne(
        { _id: existing._id },
        { $set: { payload: parsed } },
      );
    } else {
      await WebhookEventModel.create({
        provider,
        eventType: webhookPayload.eventType,
        externalId: webhookPayload.externalId,
        payload: parsed,
        processed: false,
        retryCount: 0,
      });
    }

    logger.info(
      { provider, externalId: webhookPayload.externalId, eventType: webhookPayload.eventType },
      'Webhook event ingested',
    );

    return webhookPayload;
  }

  /**
   * Mark a webhook event as successfully processed.
   */
  async markProcessed(eventId: string): Promise<void> {
    await WebhookEventModel.updateOne(
      { _id: eventId },
      { $set: { processed: true, processedAt: new Date() } },
    );
  }

  /**
   * Mark a webhook event as failed. Increments the retry counter so callers
   * can implement back-off or dead-letter strategies.
   */
  async markFailed(eventId: string, error: string): Promise<void> {
    await WebhookEventModel.updateOne(
      { _id: eventId },
      {
        $set: { error },
        $inc: { retryCount: 1 },
      },
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Verify the webhook request using either HMAC signature verification
   * (for providers that support it) or a bearer token comparison.
   */
  private verifyRequest(
    provider: string,
    rawPayload: Buffer,
    headers: Record<string, string>,
  ): void {
    // Normalise header keys to lowercase for consistent lookup
    const normalised: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalised[key.toLowerCase()] = value;
    }

    if (BEARER_TOKEN_PROVIDERS.has(provider)) {
      this.verifyBearerToken(provider, normalised);
      return;
    }

    const secretKey = SIGNATURE_SECRET_KEYS[provider];
    if (!secretKey) {
      throw new UnauthorizedError(`Unknown webhook provider: ${provider}`);
    }

    const secret = this.config[secretKey] as string | undefined;
    if (!secret) {
      throw new UnauthorizedError(
        `Webhook secret not configured for provider: ${provider}`,
      );
    }

    // Try provider adapter's own verification first
    const adapter = this.resolveAdapter(provider);
    if (adapter?.verifyWebhookSignature && adapter.getWebhookSignatureHeader) {
      const signatureHeader = adapter.getWebhookSignatureHeader().toLowerCase();
      const signature = normalised[signatureHeader];

      if (!signature) {
        throw new UnauthorizedError(
          `Missing signature header '${signatureHeader}' for provider: ${provider}`,
        );
      }

      const isValid = adapter.verifyWebhookSignature(rawPayload, signature, secret);
      if (!isValid) {
        throw new UnauthorizedError(
          `Invalid webhook signature for provider: ${provider}`,
        );
      }

      return;
    }

    // Fallback: generic HMAC-SHA256 verification
    this.verifyHmacSignature(provider, rawPayload, normalised, secret);
  }

  /**
   * Generic HMAC-SHA256 signature verification for providers that do not
   * have a dedicated adapter with custom verification logic.
   */
  private verifyHmacSignature(
    provider: string,
    rawPayload: Buffer,
    headers: Record<string, string>,
    secret: string,
  ): void {
    // Common signature header conventions
    const signatureHeaderCandidates = [
      `x-${provider}-signature`,
      'x-webhook-signature',
      'x-signature',
    ];

    let signature: string | undefined;
    for (const candidate of signatureHeaderCandidates) {
      if (headers[candidate]) {
        signature = headers[candidate];
        break;
      }
    }

    if (!signature) {
      throw new UnauthorizedError(
        `Missing webhook signature header for provider: ${provider}`,
      );
    }

    const expected = createHmac('sha256', secret).update(rawPayload).digest('hex');

    try {
      const isValid = timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
      if (!isValid) {
        throw new UnauthorizedError(
          `Invalid webhook signature for provider: ${provider}`,
        );
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError(
        `Invalid webhook signature for provider: ${provider}`,
      );
    }
  }

  /**
   * Verify a bearer token from the Authorization header. Used by providers
   * such as FAL, Ideogram, and KIE that do not use HMAC signatures.
   */
  private verifyBearerToken(
    provider: string,
    headers: Record<string, string>,
  ): void {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError(
        `Missing or malformed Authorization header for provider: ${provider}`,
      );
    }

    const token = authHeader.slice(7);

    // Resolve the expected API key for the provider from config
    const apiKeyMap: Record<string, string | undefined> = {
      fal: this.config.FAL_API_KEY,
      ideogram: this.config.IDEOGRAM_API_KEY,
      kie: this.config.KIE_API_KEY,
    };

    const expectedToken = apiKeyMap[provider];
    if (!expectedToken) {
      throw new UnauthorizedError(
        `API key not configured for bearer-token provider: ${provider}`,
      );
    }

    try {
      const isValid = timingSafeEqual(
        Buffer.from(token),
        Buffer.from(expectedToken),
      );
      if (!isValid) {
        throw new UnauthorizedError(
          `Invalid bearer token for provider: ${provider}`,
        );
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError(
        `Invalid bearer token for provider: ${provider}`,
      );
    }
  }

  /**
   * Attempt to resolve a registered provider adapter by slug. Returns
   * undefined when the provider is not registered (rather than throwing).
   */
  private resolveAdapter(provider: string): IAIProvider | undefined {
    try {
      // Video providers are the primary webhook sources
      return this.providerRegistry.getVideoAdapter(provider);
    } catch {
      try {
        return this.providerRegistry.getImageAdapter(provider);
      } catch {
        return undefined;
      }
    }
  }

  /**
   * Normalise a provider-specific payload into a standard WebhookPayload.
   *
   * Each AI provider sends callbacks with a different schema. This method
   * maps them into a single internal format.
   */
  private normalisePayload(
    provider: string,
    payload: Record<string, unknown>,
  ): WebhookPayload {
    switch (provider) {
      case 'runway':
        return this.normaliseRunwayPayload(payload);
      case 'kling':
        return this.normaliseKlingPayload(payload);
      case 'pika':
        return this.normalisePikaPayload(payload);
      case 'luma':
        return this.normaliseLumaPayload(payload);
      case 'fal':
        return this.normaliseFalPayload(payload);
      case 'ideogram':
        return this.normaliseIdeogramPayload(payload);
      case 'kie':
        return this.normaliseKiePayload(payload);
      default:
        return this.normaliseGenericPayload(provider, payload);
    }
  }

  // ── Provider-specific normalisers ──────────────────────────────────────

  private normaliseRunwayPayload(payload: Record<string, unknown>): WebhookPayload {
    const taskId = String(payload['id'] ?? payload['taskId'] ?? '');
    const status = String(payload['status'] ?? '').toUpperCase();
    const output = payload['output'] as string[] | undefined;
    const failure = payload['failure'] as string | undefined;

    return {
      provider: 'runway',
      eventType: status === 'SUCCEEDED' ? 'task.completed' : 'task.failed',
      externalId: taskId,
      status: status === 'SUCCEEDED' ? 'completed' : 'failed',
      resultUrl: output?.[0],
      error: failure,
      metadata: { originalStatus: status },
    };
  }

  private normaliseKlingPayload(payload: Record<string, unknown>): WebhookPayload {
    const taskId = String(payload['task_id'] ?? payload['id'] ?? '');
    const status = String(payload['status'] ?? payload['task_status'] ?? '');
    const videoUrl = (payload['output'] as Record<string, unknown>)?.['video_url'] as string | undefined
      ?? payload['video_url'] as string | undefined;
    const errorMsg = payload['error_message'] as string | undefined
      ?? payload['message'] as string | undefined;

    const isCompleted = ['completed', 'succeed', 'success'].includes(status.toLowerCase());

    return {
      provider: 'kling',
      eventType: isCompleted ? 'generation.completed' : 'generation.failed',
      externalId: taskId,
      status: isCompleted ? 'completed' : 'failed',
      resultUrl: videoUrl,
      error: isCompleted ? undefined : errorMsg,
      metadata: { originalStatus: status },
    };
  }

  private normalisePikaPayload(payload: Record<string, unknown>): WebhookPayload {
    const generationId = String(payload['id'] ?? payload['generation_id'] ?? '');
    const status = String(payload['status'] ?? '');
    const videoUrl = payload['video_url'] as string | undefined
      ?? payload['resultUrl'] as string | undefined;
    const errorMsg = payload['error'] as string | undefined;

    const isCompleted = ['finished', 'completed', 'success'].includes(status.toLowerCase());

    return {
      provider: 'pika',
      eventType: isCompleted ? 'video.completed' : 'video.failed',
      externalId: generationId,
      status: isCompleted ? 'completed' : 'failed',
      resultUrl: videoUrl,
      error: isCompleted ? undefined : errorMsg,
      metadata: { originalStatus: status },
    };
  }

  private normaliseLumaPayload(payload: Record<string, unknown>): WebhookPayload {
    const generationId = String(payload['id'] ?? payload['generation_id'] ?? '');
    const status = String(payload['state'] ?? payload['status'] ?? '');
    const video = payload['video'] as Record<string, unknown> | undefined;
    const videoUrl = video?.['url'] as string | undefined
      ?? payload['video_url'] as string | undefined;
    const failureReason = payload['failure_reason'] as string | undefined;

    const isCompleted = status.toLowerCase() === 'completed';

    return {
      provider: 'luma',
      eventType: isCompleted ? 'dream_machine.completed' : 'dream_machine.failed',
      externalId: generationId,
      status: isCompleted ? 'completed' : 'failed',
      resultUrl: videoUrl,
      error: isCompleted ? undefined : failureReason,
      metadata: { originalStatus: status },
    };
  }

  private normaliseFalPayload(payload: Record<string, unknown>): WebhookPayload {
    const requestId = String(payload['request_id'] ?? payload['id'] ?? '');
    const status = String(payload['status'] ?? '');
    const images = payload['images'] as Array<Record<string, unknown>> | undefined;
    const resultUrl = images?.[0]?.['url'] as string | undefined;
    const errorMsg = payload['error'] as string | undefined;

    const isCompleted = status.toLowerCase() === 'completed'
      || status.toUpperCase() === 'OK';

    return {
      provider: 'fal',
      eventType: isCompleted ? 'prediction.completed' : 'prediction.failed',
      externalId: requestId,
      status: isCompleted ? 'completed' : 'failed',
      resultUrl,
      error: isCompleted ? undefined : errorMsg,
      metadata: { originalStatus: status },
    };
  }

  private normaliseIdeogramPayload(payload: Record<string, unknown>): WebhookPayload {
    const requestId = String(payload['request_id'] ?? payload['id'] ?? '');
    const status = String(payload['status'] ?? '');
    const data = payload['data'] as Record<string, unknown> | undefined;
    const images = data?.['images'] as Array<Record<string, unknown>> | undefined;
    const resultUrl = images?.[0]?.['url'] as string | undefined;
    const errorMsg = payload['error'] as string | undefined;

    const isCompleted = status.toLowerCase() === 'completed'
      || status.toLowerCase() === 'success';

    return {
      provider: 'ideogram',
      eventType: isCompleted ? 'image.completed' : 'image.failed',
      externalId: requestId,
      status: isCompleted ? 'completed' : 'failed',
      resultUrl,
      error: isCompleted ? undefined : errorMsg,
      metadata: { originalStatus: status },
    };
  }

  private normaliseKiePayload(payload: Record<string, unknown>): WebhookPayload {
    const taskId = String(payload['task_id'] ?? payload['id'] ?? '');
    const status = String(payload['status'] ?? payload['task_status'] ?? '');
    const resultData = payload['result'] as Record<string, unknown> | undefined;
    const videoUrl = resultData?.['video_url'] as string | undefined
      ?? payload['video_url'] as string | undefined;
    const errorMsg = payload['error'] as string | undefined
      ?? payload['message'] as string | undefined;

    const isCompleted = ['completed', 'success', 'done'].includes(status.toLowerCase());

    return {
      provider: 'kie',
      eventType: isCompleted ? 'task.completed' : 'task.failed',
      externalId: taskId,
      status: isCompleted ? 'completed' : 'failed',
      resultUrl: videoUrl,
      error: isCompleted ? undefined : errorMsg,
      metadata: { originalStatus: status },
    };
  }

  private normaliseGenericPayload(
    provider: string,
    payload: Record<string, unknown>,
  ): WebhookPayload {
    const externalId = String(
      payload['id'] ?? payload['task_id'] ?? payload['request_id'] ?? payload['generation_id'] ?? '',
    );
    const status = String(payload['status'] ?? '');
    const isCompleted = ['completed', 'success', 'succeeded', 'done'].includes(
      status.toLowerCase(),
    );

    return {
      provider,
      eventType: isCompleted ? 'task.completed' : 'task.failed',
      externalId,
      status: isCompleted ? 'completed' : 'failed',
      resultUrl: payload['result_url'] as string | undefined ?? payload['url'] as string | undefined,
      error: isCompleted ? undefined : (payload['error'] as string | undefined),
      metadata: { originalStatus: status },
    };
  }
}
