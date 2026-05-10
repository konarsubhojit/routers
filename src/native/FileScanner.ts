import {requireNativeModule} from './requireNativeModule';
import {NativeScannedFileMetadata} from './types';

interface FileScannerModuleSpec {
  requestTreePermission?(): Promise<string>;
  requestDownloadsTreePermission?(): Promise<string>;
  scanTree(treeUri: string): Promise<NativeScannedFileMetadata[]>;
}

function getFileScannerModule(): FileScannerModuleSpec {
  return requireNativeModule<FileScannerModuleSpec>('FileScannerModule');
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
