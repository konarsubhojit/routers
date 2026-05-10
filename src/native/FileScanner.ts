import {NativeModules} from 'react-native';

import {NativeScannedFileMetadata} from './types';

interface FileScannerModuleSpec {
  requestTreePermission?(): Promise<string>;
  requestDownloadsTreePermission?(): Promise<string>;
  scanTree(treeUri: string): Promise<NativeScannedFileMetadata[]>;
}

function getFileScannerModule(): FileScannerModuleSpec {
  const module = NativeModules.FileScannerModule as FileScannerModuleSpec | undefined;
  if (module == null) {
    throw new Error('FileScannerModule is not available on this platform.');
  }

  return module;
}

export async function requestTreePermission(): Promise<string> {
  const fileScanner = getFileScannerModule();
  if (fileScanner.requestTreePermission != null) {
    return fileScanner.requestTreePermission();
  }
  if (fileScanner.requestDownloadsTreePermission != null) {
    return fileScanner.requestDownloadsTreePermission();
  }

  throw new Error(
    'FileScannerModule does not expose requestTreePermission or requestDownloadsTreePermission.',
  );
}

export async function requestDownloadsTreePermission(): Promise<string> {
  return requestTreePermission();
}

export async function scanTree(
  treeUri: string,
): Promise<NativeScannedFileMetadata[]> {
  return getFileScannerModule().scanTree(treeUri);
}
