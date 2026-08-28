import {
  DownloadProgress,
  EnsureModelResult,
  ModelFileSystem,
  ModelManagerError,
  ModelManifest,
} from './types';

export interface EnsureModelOptions {
  /** Path where a developer may have manually placed the model asset. */
  manualAssetPath: string;
  /** Directory (app-private storage) used to cache downloaded models. */
  cacheDir: string;
  /** URL of the JSON manifest describing the latest model version. */
  manifestUrl: string;
  fs: ModelFileSystem;
  fetchManifest: (url: string) => Promise<ModelManifest>;
  onProgress?: (progress: DownloadProgress) => void;
  /** Extra free-space cushion required beyond the reported model size. */
  storageBufferBytes?: number;
  /** Allow downloading over cellular. Defaults to false (Wi-Fi preferred). */
  allowCellular?: boolean;
  /** User explicitly triggered this download (e.g. retry button). */
  userInitiated?: boolean;
}

const DEFAULT_STORAGE_BUFFER_BYTES = 10 * 1024 * 1024; // 10MB safety margin

function cachePathFor(cacheDir: string, manifest: ModelManifest): string {
  return `${cacheDir}/mediapipe_text_classifier-${manifest.version}.tflite`;
}

async function verifyChecksum(fs: ModelFileSystem, path: string, expectedSha256: string): Promise<boolean> {
  const actual = await fs.sha256Hex(path);
  return actual.toLowerCase() === expectedSha256.toLowerCase();
}

/**
 * Ensures a usable MediaPipe text classifier model is available on disk,
 * preferring (in order):
 *   1. A manually-placed developer asset (existing dev workflow, untouched).
 *   2. A previously downloaded + checksum-verified cache entry.
 *   3. A fresh download from the manifest URL, verified before use.
 *
 * Never returns a model that failed checksum verification.
 */
export async function ensureModel(options: EnsureModelOptions): Promise<EnsureModelResult> {
  const {
    manualAssetPath,
    cacheDir,
    fs,
    fetchManifest,
    manifestUrl,
    onProgress,
    storageBufferBytes = DEFAULT_STORAGE_BUFFER_BYTES,
    allowCellular = false,
    userInitiated = false,
  } = options;

  if (await fs.exists(manualAssetPath)) {
    return {path: manualAssetPath, version: null, source: 'manual-asset'};
  }

  let manifest: ModelManifest | null = null;
  try {
    manifest = await fetchManifest(manifestUrl);
  } catch (error) {
    const cached = await findAnyValidCachedModel(fs, cacheDir);
    if (cached != null) {
      return cached;
    }
    throw new ModelManagerError(
      `Unable to reach model manifest and no cached model is available: ${String(error)}`,
      'no-network',
    );
  }

  const cachePath = cachePathFor(cacheDir, manifest);

  if (await fs.exists(cachePath)) {
    const isValid = await verifyChecksum(fs, cachePath, manifest.sha256);
    if (isValid) {
      return {path: cachePath, version: manifest.version, source: 'cache'};
    }
    // Corrupt cache entry: discard it and fall through to re-download.
    await fs.unlink(cachePath);
  }

  const connected = await fs.isConnected();
  if (!connected) {
    throw new ModelManagerError('No network connection available to download the model.', 'no-network');
  }

  if (!allowCellular && !userInitiated) {
    const onWifi = await fs.isWifi();
    if (!onWifi) {
      throw new ModelManagerError(
        'Wi-Fi is preferred for model downloads. Retry manually to allow cellular data.',
        'wifi-required',
      );
    }
  }

  const freeBytes = await fs.getFreeDiskStorageBytes();
  if (freeBytes < manifest.size + storageBufferBytes) {
    throw new ModelManagerError(
      `Insufficient storage: need ${manifest.size + storageBufferBytes} bytes, have ${freeBytes} bytes.`,
      'insufficient-storage',
    );
  }

  await fs.mkdir(cacheDir);

  const tmpPath = `${cachePath}.part`;
  try {
    await fs.download(manifest.url, tmpPath, onProgress);
  } catch (error) {
    throw new ModelManagerError(`Model download failed: ${String(error)}`, 'download-failed');
  }

  const downloadedIsValid = await verifyChecksum(fs, tmpPath, manifest.sha256);
  if (!downloadedIsValid) {
    await fs.unlink(tmpPath);
    throw new ModelManagerError(
      'Downloaded model failed SHA-256 verification and was discarded.',
      'checksum-mismatch',
    );
  }

  await fs.moveFile(tmpPath, cachePath);

  return {path: cachePath, version: manifest.version, source: 'download'};
}

/**
 * Fallback used when the manifest cannot be fetched (e.g. offline): scans
 * for any previously verified cache entry rather than failing outright.
 * This relies on the file system adapter tracking verified entries by
 * naming convention (`mediapipe_text_classifier-*.tflite`); callers that
 * cannot enumerate a directory may provide a no-op implementation.
 */
async function findAnyValidCachedModel(
  fs: ModelFileSystem,
  _cacheDir: string,
): Promise<EnsureModelResult | null> {
  const listable = fs as ModelFileSystem & {listCachedModels?: () => Promise<string[]>};
  if (typeof listable.listCachedModels !== 'function') {
    return null;
  }

  const candidates = await listable.listCachedModels();
  for (const candidate of candidates) {
    if (await fs.exists(candidate)) {
      return {path: candidate, version: null, source: 'cache'};
    }
  }

  return null;
}