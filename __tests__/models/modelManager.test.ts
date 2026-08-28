import {ensureModel} from '../../src/models/modelManager';
import {ModelFileSystem, ModelManifest} from '../../src/models/types';

function sha256OfContent(content: string): string {
  // Deterministic stand-in "hash" for tests: not cryptographic, just unique per content.
  let hash = 0;
  for (let i = 0; i < content.length; i += 1) {
    hash = Math.imul(31, hash) + content.charCodeAt(i);
  }
  return `hash-${hash}`;
}

interface FakeFile {
  content: string;
}

function createFakeFileSystem(initialFiles: Record<string, FakeFile> = {}) {
  const files = new Map<string, FakeFile>(Object.entries(initialFiles));
  const state = {
    connected: true,
    wifi: true,
    freeBytes: 1024 * 1024 * 1024,
    downloadCalls: [] as string[],
  };

  const fs: ModelFileSystem = {
    async exists(path) {
      return files.has(path);
    },
    async size(path) {
      const file = files.get(path);
      return file ? file.content.length : null;
    },
    async mkdir() {
      // no-op for the fake in-memory filesystem
    },
    async download(url, destPath) {
      state.downloadCalls.push(destPath);
      const existing = files.get(destPath);
      const startOffset = existing ? existing.content.length : 0;
      // Simulate a resumable download: the "server" always has the full
      // content for `url`; a resumed download only appends the remainder.
      const fullContent = (globalThis as {__fakeServerContent?: Map<string, string>}).__fakeServerContent?.get(
        url,
      );
      if (fullContent == null) {
        throw new Error(`no fake server content registered for ${url}`);
      }
      const remainder = fullContent.slice(startOffset);
      files.set(destPath, {content: fullContent});
      return {bytesWritten: remainder.length, totalBytes: fullContent.length};
    },
    async sha256Hex(path) {
      const file = files.get(path);
      if (!file) {
        throw new Error(`missing file ${path}`);
      }
      return sha256OfContent(file.content);
    },
    async unlink(path) {
      files.delete(path);
    },
    async moveFile(fromPath, toPath) {
      const file = files.get(fromPath);
      if (!file) {
        throw new Error(`missing file ${fromPath}`);
      }
      files.set(toPath, file);
      files.delete(fromPath);
    },
    async getFreeDiskStorageBytes() {
      return state.freeBytes;
    },
    async isWifi() {
      return state.wifi;
    },
    async isConnected() {
      return state.connected;
    },
  };

  return {fs, files, state};
}

function registerServerContent(url: string, content: string) {
  const globalWithServer = globalThis as {__fakeServerContent?: Map<string, string>};
  if (!globalWithServer.__fakeServerContent) {
    globalWithServer.__fakeServerContent = new Map();
  }
  globalWithServer.__fakeServerContent.set(url, content);
}

describe('ensureModel', () => {
  const manifestUrl = 'https://cdn.example.com/model-manifest.json';
  const modelUrl = 'https://cdn.example.com/model-v1.tflite';
  const content = 'the-model-bytes';
  const manifest: ModelManifest = {
    version: '1',
    url: modelUrl,
    sha256: sha256OfContent(content),
    size: content.length,
  };

  beforeEach(() => {
    registerServerContent(modelUrl, content);
  });

  it('prefers a manually-placed asset over manifest/download', async () => {
    const {fs} = createFakeFileSystem({
      '/assets/mediapipe_text_classifier.tflite': {content: 'manual'},
    });
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    const result = await ensureModel({
      manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
      cacheDir: '/cache',
      manifestUrl,
      fs,
      fetchManifest,
    });

    expect(result).toEqual({
      path: '/assets/mediapipe_text_classifier.tflite',
      version: null,
      source: 'manual-asset',
    });
    expect(fetchManifest).not.toHaveBeenCalled();
  });

  it('downloads, verifies, and caches a model on first launch', async () => {
    const {fs, files} = createFakeFileSystem();
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    const result = await ensureModel({
      manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
      cacheDir: '/cache',
      manifestUrl,
      fs,
      fetchManifest,
    });

    expect(result.source).toBe('download');
    expect(result.version).toBe('1');
    expect(files.has(result.path)).toBe(true);
    // Temp `.part` file must be cleaned up (moved to final path).
    expect(files.has(`${result.path}.part`)).toBe(false);
  });

  it('reuses a checksum-verified cache entry without re-downloading', async () => {
    const cachePath = '/cache/mediapipe_text_classifier-1.tflite';
    const {fs, state} = createFakeFileSystem({[cachePath]: {content}});
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    const result = await ensureModel({
      manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
      cacheDir: '/cache',
      manifestUrl,
      fs,
      fetchManifest,
    });

    expect(result).toEqual({path: cachePath, version: '1', source: 'cache'});
    expect(state.downloadCalls).toHaveLength(0);
  });

  it('discards a corrupted cache entry and re-downloads', async () => {
    const cachePath = '/cache/mediapipe_text_classifier-1.tflite';
    const {fs, files} = createFakeFileSystem({[cachePath]: {content: 'corrupted-bytes'}});
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    const result = await ensureModel({
      manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
      cacheDir: '/cache',
      manifestUrl,
      fs,
      fetchManifest,
    });

    expect(result.source).toBe('download');
    expect(files.get(cachePath)?.content).toBe(content);
  });

  it('never loads a download that fails checksum verification', async () => {
    registerServerContent(modelUrl, 'tampered-bytes');
    const {fs, files} = createFakeFileSystem();
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    await expect(
      ensureModel({
        manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
        cacheDir: '/cache',
        manifestUrl,
        fs,
        fetchManifest,
      }),
    ).rejects.toMatchObject({code: 'checksum-mismatch'});

    const cachePath = '/cache/mediapipe_text_classifier-1.tflite';
    expect(files.has(cachePath)).toBe(false);
    expect(files.has(`${cachePath}.part`)).toBe(false);
  });

  it('resumes an interrupted download from the partial byte offset', async () => {
    const partPath = '/cache/mediapipe_text_classifier-1.tflite.part';
    const partialContent = content.slice(0, 4);
    const {fs, files, state} = createFakeFileSystem({[partPath]: {content: partialContent}});
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    const result = await ensureModel({
      manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
      cacheDir: '/cache',
      manifestUrl,
      fs,
      fetchManifest,
    });

    expect(result.source).toBe('download');
    expect(files.get(result.path)?.content).toBe(content);
    expect(state.downloadCalls).toEqual([partPath]);
  });

  it('throws when there is no network and no cached model on first launch', async () => {
    const {fs} = createFakeFileSystem();
    fs.isConnected = async () => false;
    const fetchManifest = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(
      ensureModel({
        manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
        cacheDir: '/cache',
        manifestUrl,
        fs,
        fetchManifest,
      }),
    ).rejects.toMatchObject({code: 'no-network'});
  });

  it('falls back to any cached model when the manifest cannot be reached', async () => {
    const cachePath = '/cache/mediapipe_text_classifier-1.tflite';
    const {fs} = createFakeFileSystem({[cachePath]: {content}});
    (fs as ModelFileSystem & {listCachedModels: () => Promise<string[]>}).listCachedModels = async () => [
      cachePath,
    ];
    const fetchManifest = jest.fn().mockRejectedValue(new Error('offline'));

    const result = await ensureModel({
      manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
      cacheDir: '/cache',
      manifestUrl,
      fs,
      fetchManifest,
    });

    expect(result).toEqual({path: cachePath, version: null, source: 'cache'});
  });

  it('rejects the download when free storage is insufficient', async () => {
    const {fs, state} = createFakeFileSystem();
    state.freeBytes = 10;
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    await expect(
      ensureModel({
        manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
        cacheDir: '/cache',
        manifestUrl,
        fs,
        fetchManifest,
      }),
    ).rejects.toMatchObject({code: 'insufficient-storage'});
  });

  it('requires an explicit opt-in before downloading over cellular', async () => {
    const {fs} = createFakeFileSystem();
    fs.isWifi = async () => false;
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    await expect(
      ensureModel({
        manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
        cacheDir: '/cache',
        manifestUrl,
        fs,
        fetchManifest,
      }),
    ).rejects.toMatchObject({code: 'wifi-required'});
  });

  it('allows a user-initiated retry to proceed over cellular', async () => {
    const {fs} = createFakeFileSystem();
    fs.isWifi = async () => false;
    const fetchManifest = jest.fn().mockResolvedValue(manifest);

    const result = await ensureModel({
      manualAssetPath: '/assets/mediapipe_text_classifier.tflite',
      cacheDir: '/cache',
      manifestUrl,
      fs,
      fetchManifest,
      userInitiated: true,
    });

    expect(result.source).toBe('download');
  });
});
