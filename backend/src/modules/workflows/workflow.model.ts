import mongoose, { Schema } from 'mongoose';

import type { IWorkflowDocument } from './workflow.types.js';

const positionSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

const providerConfigSchema = new Schema(
  {
    provider: { type: String, required: true },
    model: { type: String },
    params: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const workflowNodeSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'script-input',
        'script-analyzer',
        'character-extractor',
        'scene-splitter',
        'image-generator',
        'frame-composer',
        'video-generator',
        'video-combiner',
        'output',
      ],
    },
    position: { type: positionSchema, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    providerConfig: { type: providerConfigSchema },
    label: { type: String },
  },
  { _id: false },
);

const workflowEdgeSchema = new Schema(
  {
    id: { type: String, required: true },
    sourceNodeId: { type: String, required: true },
    sourcePort: { type: String, required: true },
    targetNodeId: { type: String, required: true },
    targetPort: { type: String, required: true },
  },
  { _id: false },
);

const workflowSchema = new Schema<IWorkflowDocument>(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: undefined,
    },
    isTemplate: {
      type: Boolean,
      default: false,
      index: true,
    },
    nodes: {
      type: [workflowNodeSchema],
      default: [],
    },
    edges: {
      type: [workflowEdgeSchema],
      default: [],
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

workflowSchema.index({ projectId: 1, userId: 1 });
workflowSchema.index({ userId: 1, isTemplate: 1 });
workflowSchema.index({ projectId: 1, createdAt: -1 });

const WorkflowModel = mongoose.model<IWorkflowDocument>(
  'Workflow',
  workflowSchema,
);

export default WorkflowModel;
