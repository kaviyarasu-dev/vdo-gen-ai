import type { FilterQuery } from 'mongoose';

import AssetModel from './asset.model.js';
import type {
  IAssetDocument,
  ListAssetsQuery,
  AssetType,
  AssetSource,
  IAssetMetadata,
} from './asset.types.js';
import type { PaginatedResult } from '../projects/project.types.js';

export class AssetRepository {
  async create(data: {
    projectId: string;
    userId: string;
    type: AssetType;
    source: AssetSource;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    storagePath: string;
    url?: string;
    thumbnailPath?: string;
    metadata?: IAssetMetadata;
  }): Promise<IAssetDocument> {
    const asset = new AssetModel(data);
    return asset.save();
  }

  async findById(assetId: string): Promise<IAssetDocument | null> {
    return AssetModel.findById(assetId).exec();
  }

  async listByProjectId(
    projectId: string,
    query: ListAssetsQuery,
  ): Promise<PaginatedResult<IAssetDocument>> {
    const filter: FilterQuery<IAssetDocument> = { projectId };

    if (query.type) {
      filter.type = query.type;
    }

    const skip = (query.page - 1) * query.limit;

    const [assets, total] = await Promise.all([
      AssetModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      AssetModel.countDocuments(filter).exec(),
    ]);

    return {
      data: assets,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async deleteById(assetId: string): Promise<IAssetDocument | null> {
    return AssetModel.findByIdAndDelete(assetId).exec();
  }
}
