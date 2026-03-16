import mongoose, { Schema } from 'mongoose';

import type { IUserDocument } from './user.types.js';

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: undefined,
    },
    defaultProviders: {
      textAnalysis: { type: String },
      imageGeneration: { type: String },
      videoGeneration: { type: String },
    },
    providerApiKeys: {
      type: Map,
      of: String,
      default: new Map(),
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

const UserModel = mongoose.model<IUserDocument>('User', userSchema);

export default UserModel;
