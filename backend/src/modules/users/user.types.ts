import type { Document, Types } from 'mongoose';

export interface IUserDefaultProviders {
  textAnalysis?: string;
  imageGeneration?: string;
  videoGeneration?: string;
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  avatar?: string;
  defaultProviders: IUserDefaultProviders;
  providerApiKeys: Map<string, string>;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends Omit<IUser, '_id'>, Document {}

export interface IUserPublic {
  _id: Types.ObjectId;
  email: string;
  name: string;
  avatar?: string;
  defaultProviders: IUserDefaultProviders;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateUserDto {
  name?: string;
  avatar?: string;
}
