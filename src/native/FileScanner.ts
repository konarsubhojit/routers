import {NativeModules} from 'react-native';

import {NativeScannedFileMetadata} from './types';

interface FileScannerModuleSpec {
  requestDownloadsTreePermission(): Promise<string>;
  scanTree(treeUri: string): Promise<NativeScannedFileMetadata[]>;
}

function getFileScannerModule(): FileScannerModuleSpec {
  const module = NativeModules.FileScannerModule as FileScannerModuleSpec | undefined;
  if (module == null) {
    throw new Error('FileScannerModule is not available on this platform.');
  }

  return module;
}

export async function requestDownloadsTreePermission(): Promise<string> {
  return getFileScannerModule().requestDownloadsTreePermission();
}

export async function scanTree(
  treeUri: string,
): Promise<NativeScannedFileMetadata[]> {
  return getFileScannerModule().scanTree(treeUri);
}
