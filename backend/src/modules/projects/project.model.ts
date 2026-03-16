import mongoose, { Schema } from 'mongoose';

import type { IProjectDocument } from './project.types.js';

const projectSettingsSchema = new Schema(
  {
    outputResolution: {
      type: String,
      default: '1920x1080',
    },
    outputFormat: {
      type: String,
      default: 'mp4',
    },
    frameRate: {
      type: Number,
      default: 30,
    },
  },
  { _id: false },
);

const projectSchema = new Schema<IProjectDocument>(
  {
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
    settings: {
      type: projectSettingsSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ userId: 1, status: 1 });
projectSchema.index({ userId: 1, createdAt: -1 });

const ProjectModel = mongoose.model<IProjectDocument>('Project', projectSchema);

export default ProjectModel;
