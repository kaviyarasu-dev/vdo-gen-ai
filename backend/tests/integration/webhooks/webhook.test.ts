import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createHmac } from 'node:crypto';

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { IAIProvider } from '../../../src/providers/provider.interface.js';
import type { Config } from '../../../src/config/index.js';
import type { IWebhookEvent } from '../../../src/modules/webhooks/webhook.types.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// vi.hoisted ensures these are available when vi.mock factories are hoisted.
const { mockFindOne, mockCreate, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdateOne: vi.fn(),
}));

// Mock the WebhookEventModel (Mongoose model) before any imports that use it.
// Every static method is stubbed individually so tests can control DB behaviour.
vi.mock('../../../src/modules/webhooks/webhook.model.js', () => ({
  default: {
    findOne: mockFindOne,
    create: mockCreate,
    updateOne: mockUpdateOne,
  },
}));

// Mock the logger so it does not write to stdout during tests
vi.mock('../../../src/common/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports under test (must come AFTER vi.mock declarations)
// ---------------------------------------------------------------------------
import { WebhookService } from '../../../src/modules/webhooks/webhook.service.js';
import { WebhookController } from '../../../src/modules/webhooks/webhook.controller.js';
import { UnauthorizedError } from '../../../src/common/errors/unauthorized-error.js';
import { ProviderRegistry } from '../../../src/providers/provider.registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Config object with only the keys the webhook system needs. */
function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    MONGODB_URI: 'mongodb://localhost:27017/test',
    MONGODB_DB_NAME: 'vdo_gen_test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW: '1 minute',
    STORAGE_DRIVER: 'local',
    STORAGE_PATH: './uploads',
    UPLOAD_MAX_FILE_SIZE: 500 * 1024 * 1024,
    RUNWAY_WEBHOOK_SECRET: 'runway-secret-123',
    KLING_WEBHOOK_SECRET: 'kling-secret-456',
    PIKA_WEBHOOK_SECRET: 'pika-secret-789',
    LUMA_WEBHOOK_SECRET: 'luma-secret-012',
    FAL_API_KEY: 'fal-api-key-abc',
    IDEOGRAM_API_KEY: 'ideogram-api-key-def',
    KIE_API_KEY: 'kie-api-key-ghi',
    ...overrides,
  } as Config;
}

/** Compute an HMAC-SHA256 hex digest identical to the service's own logic. */
function computeHmacSignature(payload: Buffer, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Create a mock IAIProvider with optional webhook signature methods. */
function createMockAdapter(options: {
  slug: string;
  signatureHeader?: string;
  verifyFn?: (payload: Buffer, signature: string, secret: string) => boolean;
}): IAIProvider {
  return {
    slug: options.slug,
    displayName: options.slug.charAt(0).toUpperCase() + options.slug.slice(1),
    category: 'video-generation',
    validateCredentials: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([]),
    isWebhookBased: vi.fn().mockReturnValue(true),
    ...(options.signatureHeader && {
      getWebhookSignatureHeader: () => options.signatureHeader as string,
    }),
    ...(options.verifyFn && {
      verifyWebhookSignature: options.verifyFn,
    }),
  };
}

/** Build a mock FastifyRequest for controller tests. */
function createMockRequest(overrides: {
  provider: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
  rawBody?: Buffer;
}): FastifyRequest<{ Params: { provider: string } }> {
  const body = overrides.body;
  const rawBody = overrides.rawBody ?? Buffer.from(JSON.stringify(body));

  return {
    params: { provider: overrides.provider },
    body,
    headers: {
      'content-type': 'application/json',
      ...overrides.headers,
    },
    rawBody,
  } as unknown as FastifyRequest<{ Params: { provider: string } }>;
}

/** Build a mock FastifyReply with chainable status/send. */
function createMockReply(): FastifyReply & { status: Mock; send: Mock } {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
  };
  reply.status.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);
  return reply as unknown as FastifyReply & { status: Mock; send: Mock };
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('WebhookService', () => {
  let service: WebhookService;
  let registry: ProviderRegistry;
  let mockConfig: Config;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = createMockConfig();
    registry = new ProviderRegistry();
    service = new WebhookService(registry, mockConfig);

    // Default: findOne returns null (no duplicates), create resolves
    mockFindOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    mockCreate.mockResolvedValue({ _id: 'event-001' });
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Valid HMAC signature -- processes successfully
  // ─────────────────────────────────────────────────────────────────────────

  describe('valid webhook with HMAC signature', () => {
    it('should process a Runway webhook with correct HMAC signature', async () => {
      // Register a Runway adapter with custom signature verification
      const runwayAdapter = createMockAdapter({
        slug: 'runway',
        signatureHeader: 'X-Runway-Signature',
        verifyFn: (payload, signature, secret) => {
          const expected = computeHmacSignature(payload, secret);
          return signature === expected;
        },
      });
      registry.register(runwayAdapter);

      const payload = {
        id: 'task-abc-123',
        status: 'SUCCEEDED',
        output: ['https://cdn.runway.com/video/result.mp4'],
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));
      const signature = computeHmacSignature(rawPayload, 'runway-secret-123');

      const result = await service.processWebhook('runway', rawPayload, {
        'x-runway-signature': signature,
        'content-type': 'application/json',
      });

      // Verify normalised payload
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('runway');
      expect(result!.externalId).toBe('task-abc-123');
      expect(result!.status).toBe('completed');
      expect(result!.eventType).toBe('task.completed');
      expect(result!.resultUrl).toBe('https://cdn.runway.com/video/result.mp4');

      // Verify the event was persisted
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'runway',
          externalId: 'task-abc-123',
          eventType: 'task.completed',
          payload,
          processed: false,
          retryCount: 0,
        }),
      );
    });

    it('should process a Kling webhook with fallback HMAC verification', async () => {
      // No adapter registered -- uses generic HMAC fallback via
      // x-kling-signature header convention
      const payload = {
        task_id: 'kling-789',
        status: 'completed',
        output: { video_url: 'https://kling.ai/video/out.mp4' },
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));
      const signature = computeHmacSignature(rawPayload, 'kling-secret-456');

      const result = await service.processWebhook('kling', rawPayload, {
        'x-kling-signature': signature,
        'content-type': 'application/json',
      });

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('kling');
      expect(result!.externalId).toBe('kling-789');
      expect(result!.status).toBe('completed');
      expect(result!.resultUrl).toBe('https://kling.ai/video/out.mp4');
    });

    it('should process a Pika webhook with x-pika-signature header', async () => {
      const payload = {
        id: 'pika-gen-001',
        status: 'finished',
        video_url: 'https://pika.art/video/result.mp4',
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));
      const signature = computeHmacSignature(rawPayload, 'pika-secret-789');

      const result = await service.processWebhook('pika', rawPayload, {
        'x-pika-signature': signature,
      });

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('pika');
      expect(result!.externalId).toBe('pika-gen-001');
      expect(result!.status).toBe('completed');
      expect(result!.eventType).toBe('video.completed');
      expect(result!.resultUrl).toBe('https://pika.art/video/result.mp4');
    });

    it('should process a Luma webhook with x-luma-signature header', async () => {
      const payload = {
        id: 'luma-gen-999',
        state: 'completed',
        video: { url: 'https://lumalabs.ai/video/out.mp4' },
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));
      const signature = computeHmacSignature(rawPayload, 'luma-secret-012');

      const result = await service.processWebhook('luma', rawPayload, {
        'x-luma-signature': signature,
      });

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('luma');
      expect(result!.externalId).toBe('luma-gen-999');
      expect(result!.status).toBe('completed');
      expect(result!.eventType).toBe('dream_machine.completed');
      expect(result!.resultUrl).toBe('https://lumalabs.ai/video/out.mp4');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Invalid HMAC signature -- throws UnauthorizedError
  // ─────────────────────────────────────────────────────────────────────────

  describe('invalid HMAC signature', () => {
    it('should throw UnauthorizedError when adapter verification fails', async () => {
      const runwayAdapter = createMockAdapter({
        slug: 'runway',
        signatureHeader: 'X-Runway-Signature',
        verifyFn: (_payload, _signature, _secret) => false, // Always reject
      });
      registry.register(runwayAdapter);

      const payload = { id: 'task-bad', status: 'SUCCEEDED', output: [] };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('runway', rawPayload, {
          'x-runway-signature': 'definitely-wrong-signature',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when generic HMAC does not match', async () => {
      const payload = {
        task_id: 'kling-bad',
        status: 'completed',
        output: { video_url: 'https://kling.ai/video/out.mp4' },
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('kling', rawPayload, {
          'x-kling-signature': 'tampered-signature-value',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should include provider name in the error message', async () => {
      const payload = { id: 'pika-bad', status: 'finished' };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('pika', rawPayload, {
          'x-pika-signature': 'wrong',
        }),
      ).rejects.toThrow(/pika/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Duplicate webhook (idempotency) -- returns null
  // ─────────────────────────────────────────────────────────────────────────

  describe('duplicate webhook idempotency', () => {
    it('should return null for an already-processed event', async () => {
      const payload = {
        task_id: 'kling-dup',
        status: 'completed',
        output: { video_url: 'https://kling.ai/video/dup.mp4' },
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));
      const signature = computeHmacSignature(rawPayload, 'kling-secret-456');
      const headers = { 'x-kling-signature': signature };

      // Simulate an already-processed record in the DB
      mockFindOne.mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: 'existing-event-id',
            provider: 'kling',
            externalId: 'kling-dup',
            processed: true,
          } satisfies Partial<IWebhookEvent>),
      });

      const result = await service.processWebhook('kling', rawPayload, headers);

      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('should update existing unprocessed event instead of creating new one', async () => {
      const payload = {
        task_id: 'kling-retry',
        status: 'completed',
        output: { video_url: 'https://kling.ai/video/retry.mp4' },
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));
      const signature = computeHmacSignature(rawPayload, 'kling-secret-456');
      const headers = { 'x-kling-signature': signature };

      // Simulate an existing record that is NOT yet processed
      mockFindOne.mockReturnValue({
        lean: () =>
          Promise.resolve({
            _id: 'existing-unprocessed-id',
            provider: 'kling',
            externalId: 'kling-retry',
            processed: false,
          } satisfies Partial<IWebhookEvent>),
      });

      const result = await service.processWebhook('kling', rawPayload, headers);

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('kling');
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'existing-unprocessed-id' },
        { $set: { payload } },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Bearer token verification for FAL / Ideogram / KIE
  // ─────────────────────────────────────────────────────────────────────────

  describe('bearer token verification', () => {
    it('should accept a valid FAL bearer token', async () => {
      const payload = {
        request_id: 'fal-req-001',
        status: 'completed',
        images: [{ url: 'https://fal.ai/images/result.png' }],
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      const result = await service.processWebhook('fal', rawPayload, {
        authorization: `Bearer fal-api-key-abc`,
        'content-type': 'application/json',
      });

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('fal');
      expect(result!.externalId).toBe('fal-req-001');
      expect(result!.status).toBe('completed');
      expect(result!.eventType).toBe('prediction.completed');
      expect(result!.resultUrl).toBe('https://fal.ai/images/result.png');
    });

    it('should accept a valid Ideogram bearer token', async () => {
      const payload = {
        request_id: 'ideo-req-002',
        status: 'success',
        data: { images: [{ url: 'https://ideogram.ai/img/out.png' }] },
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      const result = await service.processWebhook('ideogram', rawPayload, {
        authorization: `Bearer ideogram-api-key-def`,
      });

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('ideogram');
      expect(result!.externalId).toBe('ideo-req-002');
      expect(result!.status).toBe('completed');
      expect(result!.eventType).toBe('image.completed');
      expect(result!.resultUrl).toBe('https://ideogram.ai/img/out.png');
    });

    it('should accept a valid KIE bearer token', async () => {
      const payload = {
        task_id: 'kie-task-003',
        status: 'completed',
        result: { video_url: 'https://api.kie.ai/video/out.mp4' },
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      const result = await service.processWebhook('kie', rawPayload, {
        authorization: `Bearer kie-api-key-ghi`,
      });

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('kie');
      expect(result!.externalId).toBe('kie-task-003');
      expect(result!.status).toBe('completed');
      expect(result!.eventType).toBe('task.completed');
      expect(result!.resultUrl).toBe('https://api.kie.ai/video/out.mp4');
    });

    it('should reject an invalid bearer token for FAL', async () => {
      const payload = { request_id: 'fal-bad', status: 'completed' };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('fal', rawPayload, {
          authorization: 'Bearer wrong-token',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject when bearer token is completely missing for Ideogram', async () => {
      const payload = { request_id: 'ideo-no-auth', status: 'completed' };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('ideogram', rawPayload, {
          'content-type': 'application/json',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject malformed Authorization header (no Bearer prefix)', async () => {
      const payload = { task_id: 'kie-malformed', status: 'completed' };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('kie', rawPayload, {
          authorization: 'Token kie-api-key-ghi',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Missing signature -- throws UnauthorizedError
  // ─────────────────────────────────────────────────────────────────────────

  describe('missing signature header', () => {
    it('should throw UnauthorizedError when no signature header is present for Runway', async () => {
      const runwayAdapter = createMockAdapter({
        slug: 'runway',
        signatureHeader: 'X-Runway-Signature',
        verifyFn: () => true,
      });
      registry.register(runwayAdapter);

      const payload = { id: 'task-no-sig', status: 'SUCCEEDED', output: [] };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('runway', rawPayload, {
          'content-type': 'application/json',
          // No x-runway-signature header
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when no signature header is present for generic HMAC', async () => {
      const payload = { task_id: 'kling-no-sig', status: 'completed' };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('kling', rawPayload, {
          'content-type': 'application/json',
          // No x-kling-signature, x-webhook-signature, or x-signature header
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should include descriptive message about missing header', async () => {
      const payload = { id: 'luma-no-sig', state: 'completed' };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('luma', rawPayload, {}),
      ).rejects.toThrow(/Missing webhook signature/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Unknown provider -- throws UnauthorizedError
  // ─────────────────────────────────────────────────────────────────────────

  describe('unknown provider', () => {
    it('should throw UnauthorizedError for a provider not in SIGNATURE_SECRET_KEYS or BEARER_TOKEN_PROVIDERS', async () => {
      const payload = {
        id: 'unknown-task-001',
        status: 'completed',
        result_url: 'https://example.com/video.mp4',
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      // "acme" is not in the SIGNATURE_SECRET_KEYS map or BEARER_TOKEN_PROVIDERS set
      await expect(
        service.processWebhook('acme', rawPayload, {
          'x-acme-signature': 'some-sig',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should mention the unknown provider name in the error', async () => {
      const payload = { id: 'mystery-1', status: 'done' };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      await expect(
        service.processWebhook('mystery', rawPayload, {}),
      ).rejects.toThrow(/mystery/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Additional service method tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('markProcessed', () => {
    it('should update the event with processed=true and processedAt', async () => {
      await service.markProcessed('event-xyz');

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'event-xyz' },
        { $set: { processed: true, processedAt: expect.any(Date) } },
      );
    });
  });

  describe('markFailed', () => {
    it('should update the event with error message and increment retryCount', async () => {
      await service.markFailed('event-fail-001', 'Provider returned 500');

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'event-fail-001' },
        {
          $set: { error: 'Provider returned 500' },
          $inc: { retryCount: 1 },
        },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Normalisation edge cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('payload normalisation', () => {
    it('should normalise a failed Runway webhook payload', async () => {
      const runwayAdapter = createMockAdapter({
        slug: 'runway',
        signatureHeader: 'X-Runway-Signature',
        verifyFn: (p, s, sec) => s === computeHmacSignature(p, sec),
      });
      registry.register(runwayAdapter);

      const payload = {
        id: 'task-fail-456',
        status: 'FAILED',
        failure: 'Content policy violation',
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));
      const signature = computeHmacSignature(rawPayload, 'runway-secret-123');

      const result = await service.processWebhook('runway', rawPayload, {
        'x-runway-signature': signature,
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('failed');
      expect(result!.eventType).toBe('task.failed');
      expect(result!.error).toBe('Content policy violation');
      expect(result!.resultUrl).toBeUndefined();
    });

    it('should normalise a FAL failed webhook payload', async () => {
      const payload = {
        request_id: 'fal-fail-001',
        status: 'FAILED',
        error: 'Timeout exceeded',
      };
      const rawPayload = Buffer.from(JSON.stringify(payload));

      const result = await service.processWebhook('fal', rawPayload, {
        authorization: 'Bearer fal-api-key-abc',
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('failed');
      expect(result!.eventType).toBe('prediction.failed');
      expect(result!.error).toBe('Timeout exceeded');
    });
  });
});

// ===========================================================================
// Controller Tests
// ===========================================================================

describe('WebhookController', () => {
  let controller: WebhookController;
  let mockWebhookService: {
    processWebhook: Mock;
    markProcessed: Mock;
    markFailed: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockWebhookService = {
      processWebhook: vi.fn(),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    };

    controller = new WebhookController(
      mockWebhookService as unknown as WebhookService,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Controller always returns 200
  // ─────────────────────────────────────────────────────────────────────────

  describe('always returns 200', () => {
    it('should return { received: true } on successful processing', async () => {
      mockWebhookService.processWebhook.mockResolvedValue({
        provider: 'runway',
        eventType: 'task.completed',
        externalId: 'task-123',
        status: 'completed',
        resultUrl: 'https://example.com/video.mp4',
      });

      const request = createMockRequest({
        provider: 'runway',
        body: {
          id: 'task-123',
          status: 'SUCCEEDED',
          output: ['https://example.com/video.mp4'],
        },
        headers: {
          'x-runway-signature': 'valid-sig',
        },
      });
      const reply = createMockReply();

      await controller.handleWebhook(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ received: true });
    });

    it('should return { received: true } even when service throws UnauthorizedError', async () => {
      mockWebhookService.processWebhook.mockRejectedValue(
        new UnauthorizedError('Invalid webhook signature for provider: runway'),
      );

      const request = createMockRequest({
        provider: 'runway',
        body: { id: 'task-bad', status: 'SUCCEEDED' },
        headers: {
          'x-runway-signature': 'bad-signature',
        },
      });
      const reply = createMockReply();

      await controller.handleWebhook(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ received: true });
    });

    it('should return { received: true } even when service throws a generic error', async () => {
      mockWebhookService.processWebhook.mockRejectedValue(
        new Error('Database connection lost'),
      );

      const request = createMockRequest({
        provider: 'kling',
        body: { task_id: 'kling-err', status: 'completed' },
      });
      const reply = createMockReply();

      await controller.handleWebhook(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ received: true });
    });

    it('should return { received: true } when processWebhook returns null (duplicate)', async () => {
      mockWebhookService.processWebhook.mockResolvedValue(null);

      const request = createMockRequest({
        provider: 'pika',
        body: { id: 'pika-dup', status: 'finished' },
      });
      const reply = createMockReply();

      await controller.handleWebhook(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('request parsing', () => {
    it('should pass provider from params and raw body to service', async () => {
      mockWebhookService.processWebhook.mockResolvedValue(null);

      const body = { id: 'task-777', status: 'SUCCEEDED', output: [] };
      const rawBody = Buffer.from(JSON.stringify(body));

      const request = createMockRequest({
        provider: 'runway',
        body,
        headers: { 'x-runway-signature': 'sig-value' },
        rawBody,
      });
      const reply = createMockReply();

      await controller.handleWebhook(request, reply);

      expect(mockWebhookService.processWebhook).toHaveBeenCalledWith(
        'runway',
        rawBody,
        expect.objectContaining({
          'x-runway-signature': 'sig-value',
          'content-type': 'application/json',
        }),
      );
    });

    it('should fall back to JSON.stringify(body) when rawBody is not set', async () => {
      mockWebhookService.processWebhook.mockResolvedValue(null);

      const body = { id: 'task-fallback', status: 'FAILED' };

      // Build request WITHOUT rawBody
      const request = {
        params: { provider: 'runway' },
        body,
        headers: {
          'content-type': 'application/json',
          'x-runway-signature': 'some-sig',
        },
        // No rawBody property at all
      } as unknown as FastifyRequest<{ Params: { provider: string } }>;

      const reply = createMockReply();

      await controller.handleWebhook(request, reply);

      const [, rawBodyArg] = mockWebhookService.processWebhook.mock.calls[0] as [
        string,
        Buffer,
        Record<string, string>,
      ];

      expect(rawBodyArg).toBeInstanceOf(Buffer);
      expect(rawBodyArg.toString('utf-8')).toBe(JSON.stringify(body));
    });

    it('should extract string headers and flatten array headers', async () => {
      mockWebhookService.processWebhook.mockResolvedValue(null);

      const request = {
        params: { provider: 'fal' },
        body: { request_id: 'fal-h', status: 'completed' },
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer fal-api-key-abc',
          'x-custom': ['first-value', 'second-value'], // Array header
        },
        rawBody: Buffer.from('{}'),
      } as unknown as FastifyRequest<{ Params: { provider: string } }>;

      const reply = createMockReply();

      await controller.handleWebhook(request, reply);

      const [, , headersArg] = mockWebhookService.processWebhook.mock.calls[0] as [
        string,
        Buffer,
        Record<string, string>,
      ];

      // Array headers should be collapsed to the first element
      expect(headersArg['x-custom']).toBe('first-value');
      expect(headersArg['authorization']).toBe('Bearer fal-api-key-abc');
    });
  });
});
