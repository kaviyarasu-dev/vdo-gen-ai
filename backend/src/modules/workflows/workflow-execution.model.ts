import mongoose, { Schema } from 'mongoose';

import type { IWorkflowExecutionDocument } from './workflow.types.js';

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

const snapshotNodeSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    position: { type: positionSchema, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    providerConfig: { type: providerConfigSchema },
    label: { type: String },
  },
  { _id: false },
);

const snapshotEdgeSchema = new Schema(
  {
    id: { type: String, required: true },
    sourceNodeId: { type: String, required: true },
    sourcePort: { type: String, required: true },
    targetNodeId: { type: String, required: true },
    targetPort: { type: String, required: true },
  },
  { _id: false },
);

const nodeExecutionStateSchema = new Schema(
  {
    nodeId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'queued', 'running', 'completed', 'failed', 'skipped'],
      default: 'pending',
    },
    jobId: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    error: { type: String },
    progress: { type: Number, min: 0, max: 100 },
  },
  { _id: false },
);

const executionErrorSchema = new Schema(
  {
    nodeId: { type: String, required: true },
    message: { type: String, required: true },
    retryCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const progressSchema = new Schema(
  {
    totalNodes: { type: Number, required: true },
    completedNodes: { type: Number, default: 0 },
    currentNodeId: { type: String },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

const workflowExecutionSchema = new Schema<IWorkflowExecutionDocument>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
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
    status: {
      type: String,
      enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    workflowSnapshot: {
      nodes: { type: [snapshotNodeSchema], required: true },
      edges: { type: [snapshotEdgeSchema], required: true },
    },
    nodeStates: {
      type: Map,
      of: nodeExecutionStateSchema,
      default: new Map(),
    },
    nodeOutputs: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    error: { type: executionErrorSchema },
    progress: {
      type: progressSchema,
      required: true,
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

workflowExecutionSchema.index({ workflowId: 1, status: 1 });
workflowExecutionSchema.index({ userId: 1, createdAt: -1 });
workflowExecutionSchema.index({ projectId: 1, createdAt: -1 });

const WorkflowExecutionModel = mongoose.model<IWorkflowExecutionDocument>(
  'WorkflowExecution',
  workflowExecutionSchema,
);

export default WorkflowExecutionModel;
