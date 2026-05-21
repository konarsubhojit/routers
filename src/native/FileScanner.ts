import {NativeModules} from 'react-native';

import {NativeScannedFileMetadata} from './types';

/** Error codes surfaced by the native FileScannerModule. */
export type FileScannerErrorCode =
  | 'E_NO_ACTIVITY'
  | 'E_PERMISSION_IN_PROGRESS'
  | 'E_PERMISSION_REQUEST_FAILED'
  | 'E_PERMISSION_CANCELLED'
  | 'E_PERSIST_PERMISSION_FAILED'
  | 'E_PERMISSION_DENIED'
  | 'E_INVALID_TREE_URI'
  | 'E_UNSUPPORTED_URI_SCHEME'
  | 'E_SCAN_FAILED';

/**
 * Returns true when the given error is a native FileScannerModule rejection
 * with the specified error code.
 */
export function isFileScannerError(
  error: unknown,
  code: FileScannerErrorCode,
): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  return (error as {code?: unknown}).code === code;
}

interface FileScannerModuleSpec {
  requestTreePermission?(): Promise<string>;
  requestDownloadsTreePermission?(): Promise<string>;
  scanTree(treeUri: string): Promise<NativeScannedFileMetadata[]>;
  requestManageExternalStorage?(): Promise<void>;
  checkManageExternalStorageGranted?(): Promise<boolean>;
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

/**
 * Opens the system settings screen that lets the user grant
 * MANAGE_EXTERNAL_STORAGE (Android 11+ / API 30+).
 * Resolves once the settings screen has been opened; the caller must
 * subsequently call `checkManageExternalStorageGranted` to verify the result.
 * On Android < 11 this resolves immediately because the permission is
 * implicitly available through READ_EXTERNAL_STORAGE.
 */
export async function requestManageExternalStorage(): Promise<void> {
  const fileScanner = getFileScannerModule();
  if (fileScanner.requestManageExternalStorage != null) {
    return fileScanner.requestManageExternalStorage();
  }
  // Older module builds that don't expose this method treat the permission
  // as always granted (they run on <Android 11).
}

/**
 * Returns true when the app holds MANAGE_EXTERNAL_STORAGE on Android 11+,
 * or true unconditionally on earlier API levels where the permission is
 * automatically available through READ_EXTERNAL_STORAGE.
 */
export async function checkManageExternalStorageGranted(): Promise<boolean> {
  const fileScanner = getFileScannerModule();
  if (fileScanner.checkManageExternalStorageGranted != null) {
    return fileScanner.checkManageExternalStorageGranted();
  }
  return true;
}
