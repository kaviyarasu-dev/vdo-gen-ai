import type { IStorageAdapter } from './storage.interface.js';

/**
 * S3 storage adapter stub.
 * Implements the same interface for future AWS S3 / compatible storage.
 */
export class S3StorageAdapter implements IStorageAdapter {
  async upload(_file: Buffer, path: string, _mimeType: string): Promise<string> {
    throw new Error(`S3 storage not implemented. Path: ${path}`);
  }

  async download(path: string): Promise<Buffer> {
    throw new Error(`S3 storage not implemented. Path: ${path}`);
  }

  async delete(path: string): Promise<void> {
    throw new Error(`S3 storage not implemented. Path: ${path}`);
  }

  getUrl(path: string): string {
    return `https://s3.example.com/${path}`;
  }

  async exists(_path: string): Promise<boolean> {
    throw new Error('S3 storage not implemented');
  }
}
