import type { Document, Types } from 'mongoose';

export interface IWebhookEvent {
  _id: Types.ObjectId;
  provider: string;
  eventType: string;
  externalId: string;
  payload: Record<string, unknown>;
  executionId?: Types.ObjectId;
  nodeId?: string;
  jobId?: string;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWebhookEventDocument extends Omit<IWebhookEvent, '_id'>, Document {}

export interface WebhookPayload {
  provider: string;
  eventType: string;
  externalId: string;
  status: 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
