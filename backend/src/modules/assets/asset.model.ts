import mongoose, { Schema } from 'mongoose';

import type { IAssetDocument } from './asset.types.js';

const assetMetadataSchema = new Schema(
  {
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
    generatedBy: {
      provider: { type: String },
      model: { type: String },
      prompt: { type: String },
      params: { type: Schema.Types.Mixed },
    },
  },
  { _id: false },
);

const assetSchema = new Schema<IAssetDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['image', 'video', 'script', 'audio'],
      required: true,
    },
    source: {
      type: String,
      enum: ['upload', 'generated'],
      default: 'upload',
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    url: {
      type: String,
    },
    thumbnailPath: {
      type: String,
    },
    metadata: {
      type: assetMetadataSchema,
      default: () => ({}),
    },
    executionId: {
      type: Schema.Types.ObjectId,
    },
    nodeId: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

assetSchema.index({ projectId: 1, type: 1 });
assetSchema.index({ executionId: 1 });

const AssetModel = mongoose.model<IAssetDocument>('Asset', assetSchema);

export default AssetModel;
