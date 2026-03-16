import type { IStorageAdapter } from './storage.interface.js';
import { LocalStorageAdapter } from './local-storage.adapter.js';
import { S3StorageAdapter } from './s3-storage.adapter.js';

export type StorageDriver = 'local' | 's3';

export function createStorageAdapter(
  driver: StorageDriver,
  storagePath: string,
): IStorageAdapter {
  switch (driver) {
    case 'local':
      return new LocalStorageAdapter(storagePath);
    case 's3':
      return new S3StorageAdapter();
    default:
      throw new Error(`Unknown storage driver: ${driver as string}`);
  }
}
