export interface IStorageAdapter {
  upload(file: Buffer, path: string, mimeType: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
  exists(path: string): Promise<boolean>;
}
