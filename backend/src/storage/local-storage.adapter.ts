import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { IStorageAdapter } from './storage.interface.js';

export class LocalStorageAdapter implements IStorageAdapter {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = resolve(basePath);
  }

  async upload(file: Buffer, path: string, _mimeType: string): Promise<string> {
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file);
    return path;
  }

  async download(path: string): Promise<Buffer> {
    const fullPath = join(this.basePath, path);
    return readFile(fullPath);
  }

  async delete(path: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    try {
      await unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getUrl(path: string): string {
    return `/api/v1/assets/file/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = join(this.basePath, path);
    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  getBasePath(): string {
    return this.basePath;
  }
}
