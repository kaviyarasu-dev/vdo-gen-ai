import type { ProviderCategory, ProviderModel } from './provider.types.js';

export interface IAIProvider {
  readonly slug: string;
  readonly displayName: string;
  readonly category: ProviderCategory;

  validateCredentials(apiKey: string): Promise<boolean>;
  listModels(): Promise<ProviderModel[]>;
  isWebhookBased(): boolean;
  getWebhookSignatureHeader?(): string;
  verifyWebhookSignature?(payload: Buffer, signature: string, secret: string): boolean;
}
