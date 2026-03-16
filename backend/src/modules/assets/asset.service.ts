import sharp from 'sharp';
import { lookup } from 'mime-types';

import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/index.js';
import { logger } from '../../common/utils/logger.js';
import { generateId } from '../../common/utils/id-generator.js';
import type { IStorageAdapter } from '../../storage/storage.interface.js';
import type { ProjectService } from '../projects/project.service.js';
import type { AssetRepository } from './asset.repository.js';
import type {
  IAssetDocument,
  AssetType,
  ListAssetsQuery,
  IAssetMetadata,
} from './asset.types.js';
import type { PaginatedResult } from '../projects/project.types.js';

const ALLOWED_TYPES: Record<AssetType, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  script: ['text/plain', 'application/pdf'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
};

const MAX_FILE_SIZE: Record<AssetType, number> = {
  image: 20 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  script: 5 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};

const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 320;

interface UploadDeps {
  assetRepository: AssetRepository;
  projectService: ProjectService;
  storageAdapter: IStorageAdapter;
}

export class AssetService {
  private readonly assetRepository: AssetRepository;
  private readonly projectService: ProjectService;
  private readonly storageAdapter: IStorageAdapter;

  constructor(deps: UploadDeps) {
    this.assetRepository = deps.assetRepository;
    this.projectService = deps.projectService;
    this.storageAdapter = deps.storageAdapter;
  }

  async upload(
    projectId: string,
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<IAssetDocument> {
    // Verify project access
    await this.projectService.getById(projectId, userId);

    // Determine asset type from mime
    const assetType = this.resolveAssetType(mimeType);
    if (!assetType) {
      throw new ValidationError('Unsupported file type', {
        mimeType,
        allowed: Object.values(ALLOWED_TYPES).flat(),
      });
    }

    // Validate size
    const maxSize = MAX_FILE_SIZE[assetType];
    if (fileBuffer.length > maxSize) {
      throw new ValidationError(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`, {
        maxSize,
        actualSize: fileBuffer.length,
      });
    }

    // Generate unique filename
    const ext = this.extractExtension(originalName, mimeType);
    const filename = `${generateId()}.${ext}`;
    const storagePath = `${assetType}s/${filename}`;

    // Upload to storage
    await this.storageAdapter.upload(fileBuffer, storagePath, mimeType);

    // Extract metadata
    const metadata = await this.extractMetadata(fileBuffer, assetType, mimeType);

    // Generate thumbnail for images
    let thumbnailPath: string | undefined;
    if (assetType === 'image') {
      thumbnailPath = await this.generateThumbnail(fileBuffer, filename);
    }

    // Create DB record
    const asset = await this.assetRepository.create({
      projectId,
      userId,
      type: assetType,
      source: 'upload',
      filename,
      originalName,
      mimeType,
      size: fileBuffer.length,
      storagePath,
      url: this.storageAdapter.getUrl(storagePath),
      thumbnailPath,
      metadata,
    });

    logger.info(
      { assetId: asset._id, projectId, type: assetType, size: fileBuffer.length },
      'Asset uploaded',
    );

    return asset;
  }

  async getById(
    assetId: string,
    userId: string,
  ): Promise<IAssetDocument> {
    const asset = await this.assetRepository.findById(assetId);

    if (!asset) {
      throw new NotFoundError('Asset');
    }

    if (asset.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have access to this asset');
    }

    return asset;
  }

  async listByProject(
    projectId: string,
    userId: string,
    query: ListAssetsQuery,
  ): Promise<PaginatedResult<IAssetDocument>> {
    // Verify project access
    await this.projectService.getById(projectId, userId);

    return this.assetRepository.listByProjectId(projectId, query);
  }

  async download(
    assetId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; asset: IAssetDocument }> {
    const asset = await this.getById(assetId, userId);
    const buffer = await this.storageAdapter.download(asset.storagePath);
    return { buffer, asset };
  }

  async deleteAsset(
    assetId: string,
    userId: string,
  ): Promise<void> {
    const asset = await this.getById(assetId, userId);

    // Delete file from storage
    await this.storageAdapter.delete(asset.storagePath);

    // Delete thumbnail if present
    if (asset.thumbnailPath) {
      await this.storageAdapter.delete(asset.thumbnailPath);
    }

    // Remove DB record
    await this.assetRepository.deleteById(assetId);

    logger.info({ assetId, projectId: asset.projectId }, 'Asset deleted');
  }

  private resolveAssetType(mimeType: string): AssetType | null {
    for (const [type, mimes] of Object.entries(ALLOWED_TYPES)) {
      if (mimes.includes(mimeType)) {
        return type as AssetType;
      }
    }
    return null;
  }

  private extractExtension(originalName: string, mimeType: string): string {
    const fromName = originalName.split('.').pop()?.toLowerCase();
    if (fromName && fromName.length <= 10) {
      return fromName;
    }

    // Fallback to mime type lookup
    const mimeExt = lookup(mimeType);
    if (typeof mimeExt === 'string') {
      return mimeExt;
    }

    return 'bin';
  }

  private async extractMetadata(
    buffer: Buffer,
    assetType: AssetType,
    _mimeType: string,
  ): Promise<IAssetMetadata> {
    const metadata: IAssetMetadata = {};

    if (assetType === 'image') {
      try {
        const imageInfo = await sharp(buffer).metadata();
        metadata.width = imageInfo.width;
        metadata.height = imageInfo.height;
      } catch {
        logger.warn('Failed to extract image metadata');
      }
    }

    return metadata;
  }

  private async generateThumbnail(
    buffer: Buffer,
    filename: string,
  ): Promise<string | undefined> {
    try {
      const thumbnailBuffer = await sharp(buffer)
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailFilename = `thumb_${filename.replace(/\.[^.]+$/, '.jpg')}`;
      const thumbnailPath = `thumbnails/${thumbnailFilename}`;

      await this.storageAdapter.upload(thumbnailBuffer, thumbnailPath, 'image/jpeg');

      return thumbnailPath;
    } catch (error) {
      logger.warn({ error }, 'Failed to generate thumbnail');
      return undefined;
    }
  }
}
