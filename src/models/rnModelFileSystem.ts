import RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';
import {DownloadProgress, ModelDownloadResult, ModelFileSystem} from './types';

/** Bounded read/append window (bytes) used when stitching a resumed download onto the
 * existing cached file, so a large resumed range never has to be held in memory at once. */
const APPEND_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

/**
 * Appends the contents of `chunkPath` onto `destPath` in bounded-size windows (rather than
 * reading the entire resumed range into memory as one base64 string), keeping peak memory
 * usage roughly constant regardless of how large the resumed byte range is.
 */
async function appendFileInChunks(chunkPath: string, destPath: string): Promise<void> {
  const chunkSize = Number((await RNFS.stat(chunkPath)).size);
  let position = 0;

  while (position < chunkSize) {
    const length = Math.min(APPEND_CHUNK_SIZE_BYTES, chunkSize - position);
    const base64Window = await RNFS.read(chunkPath, length, position, 'base64');
    await RNFS.appendFile(destPath, base64Window, 'base64');
    position += length;
  }
}

/**
 * Production `ModelFileSystem` backed by `react-native-fs` (storage) and
 * `@react-native-community/netinfo` (connectivity). Kept separate from
 * `modelManager.ts` so the manager itself has zero native dependencies and
 * stays fully unit-testable.
 */
export function createRNModelFileSystem(): ModelFileSystem {
  return {
    async exists(path: string): Promise<boolean> {
      return RNFS.exists(path);
    },

    async size(path: string): Promise<number | null> {
      try {
        const stat = await RNFS.stat(path);
        return Number(stat.size);
      } catch {
        return null;
      }
    },

    async mkdir(path: string): Promise<void> {
      await RNFS.mkdir(path);
    },

    async download(
      url: string,
      destPath: string,
      onProgress?: (progress: DownloadProgress) => void,
    ): Promise<ModelDownloadResult> {
      const alreadyExists = await RNFS.exists(destPath);
      const existingSize = alreadyExists ? Number((await RNFS.stat(destPath)).size) : 0;

      const chunkPath = `${destPath}.chunk`;
      const headers = existingSize > 0 ? {Range: `bytes=${existingSize}-`} : undefined;

      const {promise} = RNFS.downloadFile({
        fromUrl: url,
        toFile: chunkPath,
        headers,
        progressDivider: 5,
        progress: result => {
          onProgress?.({
            bytesWritten: existingSize + result.bytesWritten,
            totalBytes: existingSize + result.contentLength,
          });
        },
      });

      await promise;

      if (existingSize > 0) {
        await appendFileInChunks(chunkPath, destPath);
        await RNFS.unlink(chunkPath);
      } else {
        await RNFS.moveFile(chunkPath, destPath);
      }

      const finalSize = Number((await RNFS.stat(destPath)).size);
      return {bytesWritten: finalSize - existingSize, totalBytes: finalSize};
    },

    async sha256Hex(path: string): Promise<string> {
      return RNFS.hash(path, 'sha256');
    },

    async unlink(path: string): Promise<void> {
      const fileExists = await RNFS.exists(path);
      if (fileExists) {
        await RNFS.unlink(path);
      }
    },

    async moveFile(fromPath: string, toPath: string): Promise<void> {
      await RNFS.moveFile(fromPath, toPath);
    },

    async getFreeDiskStorageBytes(): Promise<number> {
      const info = await RNFS.getFSInfo();
      return info.freeSpace;
    },

    async isWifi(): Promise<boolean> {
      const state = await NetInfo.fetch();
      return state.type === 'wifi';
    },

    async isConnected(): Promise<boolean> {
      const state = await NetInfo.fetch();
      return Boolean(state.isConnected);
    },
  };
}

export const modelCacheDirectory = `${RNFS.DocumentDirectoryPath}/models`;
