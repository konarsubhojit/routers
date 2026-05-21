import {NativeModules} from 'react-native';

import {ExtensionBucket} from '../preprocess/extensionBuckets';

export const DESTINATION_STRATEGIES = [
  'inside-selected-folder',
  'alongside-selected-folder',
] as const;

export type DestinationStrategy = (typeof DESTINATION_STRATEGIES)[number];

export const DEFAULT_DESTINATION_STRATEGY: DestinationStrategy =
  'inside-selected-folder';

type FolderManagerErrorCode =
  | 'E_MODULE_UNAVAILABLE'
  | 'E_INVALID_TREE_URI'
  | 'E_INVALID_DIRECTORY_NAME'
  | 'E_TREE_ACCESS_FAILED'
  | 'E_NAME_CONFLICT'
  | 'E_CREATE_FAILED'
  | 'E_PERMISSION_DENIED'
  | 'E_ENSURE_DIRECTORY_FAILED'
  | 'E_UNKNOWN';

const ERROR_MESSAGES: Record<FolderManagerErrorCode, string> = {
  E_MODULE_UNAVAILABLE: 'FolderManagerModule is not available on this platform.',
  E_INVALID_TREE_URI: 'Provided URI is not a valid SAF tree URI.',
  E_INVALID_DIRECTORY_NAME:
    'Directory name must be a non-empty single path segment.',
  E_TREE_ACCESS_FAILED: 'Unable to access the provided SAF tree URI.',
  E_NAME_CONFLICT:
    'A non-directory document already exists with the requested name.',
  E_CREATE_FAILED: 'Failed to create the requested child directory.',
  E_PERMISSION_DENIED: 'Missing write permission for the provided SAF tree URI.',
  E_ENSURE_DIRECTORY_FAILED: 'Failed to ensure child directory.',
  E_UNKNOWN: 'FolderManagerModule request failed.',
};

interface FolderManagerModuleSpec {
  ensureChildDirectory(treeUri: string, name: string): Promise<string>;
}

type NativeErrorLike = {
  code?: unknown;
  message?: unknown;
};

export class FolderManagerError extends Error {
  readonly code: FolderManagerErrorCode;

  constructor(code: FolderManagerErrorCode, message: string) {
    super(message);
    this.name = 'FolderManagerError';
    this.code = code;
  }
}

function getFolderManagerModule(): FolderManagerModuleSpec {
  const module = NativeModules.FolderManagerModule as
    | FolderManagerModuleSpec
    | undefined;
  if (module == null) {
    throw new FolderManagerError(
      'E_MODULE_UNAVAILABLE',
      ERROR_MESSAGES.E_MODULE_UNAVAILABLE,
    );
  }

  return module;
}

function toFolderManagerError(error: unknown): FolderManagerError {
  if (error instanceof FolderManagerError) {
    return error;
  }

  const nativeError = (error ?? {}) as NativeErrorLike;
  const code =
    typeof nativeError.code === 'string' && nativeError.code in ERROR_MESSAGES
      ? (nativeError.code as FolderManagerErrorCode)
      : 'E_UNKNOWN';
  const message =
    typeof nativeError.message === 'string' && nativeError.message.trim().length > 0
      ? nativeError.message
      : ERROR_MESSAGES[code];

  return new FolderManagerError(code, message);
}

export async function ensureChildDirectory(
  treeUri: string,
  name: ExtensionBucket,
): Promise<string> {
  try {
    return await getFolderManagerModule().ensureChildDirectory(treeUri, name);
  } catch (error) {
    throw toFolderManagerError(error);
  }
}

export function resolveDestinationTreeUri(
  selectedTreeUri: string,
  strategy: DestinationStrategy = DEFAULT_DESTINATION_STRATEGY,
): string {
  if (strategy === 'inside-selected-folder') {
    return selectedTreeUri;
  }

  const match = selectedTreeUri.match(
    /^(content:\/\/[^/]+\/tree\/)([^/]+)(\/document\/)([^/?#]+)(.*)$/,
  );
  if (match == null) {
    throw new Error('Cannot resolve alongside destination from an invalid SAF tree URI.');
  }

  const [, treePrefix, _encodedTreeId, documentPrefix, encodedDocumentId, suffix] =
    match;
  const parentDocumentId = getParentDocumentId(decodeURIComponent(encodedDocumentId));
  if (parentDocumentId == null) {
    throw new Error(
      'Cannot resolve alongside destination without a parent directory.',
    );
  }

  const encodedParentDocumentId = encodeURIComponent(parentDocumentId);
  return `${treePrefix}${encodedParentDocumentId}${documentPrefix}${encodedParentDocumentId}${suffix}`;
}

export async function ensureBucketDirectory(
  selectedTreeUri: string,
  bucket: ExtensionBucket,
  strategy: DestinationStrategy = DEFAULT_DESTINATION_STRATEGY,
): Promise<string> {
  return ensureChildDirectory(resolveDestinationTreeUri(selectedTreeUri, strategy), bucket);
}

function getParentDocumentId(documentId: string): string | null {
  const separatorIndex = documentId.indexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  const rootPrefix = documentId.slice(0, separatorIndex + 1);
  const relativePath = documentId.slice(separatorIndex + 1);
  if (relativePath.length === 0) {
    return null;
  }

  const lastSlashIndex = relativePath.lastIndexOf('/');
  if (lastSlashIndex < 0) {
    return rootPrefix;
  }

  return `${rootPrefix}${relativePath.slice(0, lastSlashIndex)}`;
}
