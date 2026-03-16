import type { Document, Types } from 'mongoose';

export type AssetType = 'image' | 'video' | 'script' | 'audio';
export type AssetSource = 'upload' | 'generated';

export interface IAssetGeneratedBy {
  provider: string;
  model: string;
  prompt?: string;
  params?: Record<string, unknown>;
}

export interface IAssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  generatedBy?: IAssetGeneratedBy;
}

export interface IAsset {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  type: AssetType;
  source: AssetSource;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  url?: string;
  thumbnailPath?: string;
  metadata: IAssetMetadata;
  executionId?: Types.ObjectId;
  nodeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAssetDocument extends Omit<IAsset, '_id'>, Document {}

export interface ListAssetsQuery {
  type?: AssetType;
  page: number;
  limit: number;
}
