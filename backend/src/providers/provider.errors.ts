import { AppError } from '../common/errors/app-error.js';

export class ProviderError extends AppError {
  public readonly provider: string;
  public readonly providerCode?: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    provider: string,
    options: {
      providerCode?: string;
      retryable?: boolean;
      statusCode?: number;
      code?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(
      message,
      options.statusCode ?? 502,
      options.code ?? 'PROVIDER_ERROR',
      true,
      options.details,
    );
    this.provider = provider;
    this.providerCode = options.providerCode;
    this.retryable = options.retryable ?? false;
  }
}

export class ProviderRateLimitError extends ProviderError {
  public readonly retryAfterMs: number;

  constructor(
    provider: string,
    retryAfterMs: number,
    details?: Record<string, unknown>,
  ) {
    super(`Rate limit exceeded for provider: ${provider}`, provider, {
      retryable: true,
      statusCode: 429,
      code: 'PROVIDER_RATE_LIMIT',
      details,
    });
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderTimeoutError extends ProviderError {
  public readonly timeoutMs: number;

  constructor(
    provider: string,
    timeoutMs: number,
    details?: Record<string, unknown>,
  ) {
    super(`Provider request timed out after ${timeoutMs}ms: ${provider}`, provider, {
      retryable: true,
      statusCode: 504,
      code: 'PROVIDER_TIMEOUT',
      details,
    });
    this.timeoutMs = timeoutMs;
  }
}
