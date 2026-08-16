export interface ModelManifest {
  version: string;
  url: string;
  sha256: string;
  size: number;
}

export interface DownloadProgress {
  bytesWritten: number;
  totalBytes: number;
}

export interface ModelDownloadResult {
  /** Bytes downloaded in this call, starting from any resumed offset. */
  bytesWritten: number;
  /** Total size reported for the download, if known. */
  totalBytes: number;
}

/**
 * Minimal filesystem surface the model manager needs. Kept small and
 * injectable so the manager is fully unit-testable without native modules.
 */
export interface ModelFileSystem {
  exists(path: string): Promise<boolean>;
  /** Size in bytes of an existing file, or null if it does not exist. */
  size(path: string): Promise<number | null>;
  mkdir(path: string): Promise<void>;
  /**
   * Download `url` into `destPath`. If a partial file already exists at
   * `destPath` and the server supports it, implementations should resume
   * from the existing byte offset (HTTP Range). Must report progress via
   * `onProgress`.
   */
  download(
    url: string,
    destPath: string,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<ModelDownloadResult>;
  readAsHex(path: string): Promise<string>;
  sha256Hex(path: string): Promise<string>;
  unlink(path: string): Promise<void>;
  moveFile(fromPath: string, toPath: string): Promise<void>;
  getFreeDiskStorageBytes(): Promise<number>;
  isWifi(): Promise<boolean>;
  isConnected(): Promise<boolean>;
}

export type ModelSource = 'manual-asset' | 'cache' | 'download';

export interface EnsureModelResult {
  path: string;
  version: string | null;
  source: ModelSource;
}

export class ModelManagerError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'no-network'
      | 'checksum-mismatch'
      | 'insufficient-storage'
      | 'manifest-fetch-failed'
      | 'download-failed'
      | 'wifi-required',
  ) {
    super(message);
    this.name = 'ModelManagerError';
  }
}
