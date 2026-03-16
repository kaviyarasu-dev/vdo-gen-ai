import mongoose, { Schema } from 'mongoose';

import type { IWebhookEventDocument } from './webhook.types.js';

const webhookEventSchema = new Schema<IWebhookEventDocument>(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    executionId: {
      type: Schema.Types.ObjectId,
      ref: 'WorkflowExecution',
      default: undefined,
    },
    nodeId: {
      type: String,
      default: undefined,
    },
    jobId: {
      type: String,
      default: undefined,
    },
    processed: {
      type: Boolean,
      required: true,
      default: false,
    },
    processedAt: {
      type: Date,
      default: undefined,
    },
    error: {
      type: String,
      default: undefined,
    },
    retryCount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for idempotency checks
webhookEventSchema.index({ provider: 1, externalId: 1 }, { unique: true });

// Index for querying unprocessed events
webhookEventSchema.index({ processed: 1 });

// Index for chronological queries and TTL-based cleanup
webhookEventSchema.index({ createdAt: 1 });

const WebhookEventModel = mongoose.model<IWebhookEventDocument>(
  'WebhookEvent',
  webhookEventSchema,
);

export default WebhookEventModel;
