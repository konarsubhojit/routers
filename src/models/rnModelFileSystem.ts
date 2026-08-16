import RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';
import {DownloadProgress, ModelDownloadResult, ModelFileSystem} from './types';

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
        const chunkContents = await RNFS.readFile(chunkPath, 'base64');
        await RNFS.appendFile(destPath, chunkContents, 'base64');
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
