import {NativeModules} from 'react-native';

type FileMoverErrorCode =
  | 'E_MODULE_UNAVAILABLE'
  | 'E_INVALID_SOURCE_URI'
  | 'E_INVALID_DESTINATION_URI'
  | 'E_INVALID_DISPLAY_NAME'
  | 'E_NAME_CONFLICT'
  | 'E_PERMISSION_DENIED'
  | 'E_MOVE_FAILED'
  | 'E_COPY_FAILED'
  | 'E_DELETE_FAILED'
  | 'E_UNKNOWN';

const ERROR_MESSAGES: Record<FileMoverErrorCode, string> = {
  E_MODULE_UNAVAILABLE: 'FileMoverModule is not available on this platform.',
  E_INVALID_SOURCE_URI: 'Provided source URI is not a valid SAF document URI.',
  E_INVALID_DESTINATION_URI:
    'Provided destination URI is not a valid SAF tree URI.',
  E_INVALID_DISPLAY_NAME:
    'Display name must be a non-empty single path segment.',
  E_NAME_CONFLICT:
    'A document already exists in the destination folder with this name.',
  E_PERMISSION_DENIED:
    'Missing read/write permission for the provided SAF document URIs.',
  E_MOVE_FAILED: 'Failed to move document.',
  E_COPY_FAILED: 'Failed to copy document to destination.',
  E_DELETE_FAILED: 'Moved copy created, but failed to delete the source document.',
  E_UNKNOWN: 'FileMoverModule request failed.',
};

interface FileMoverModuleSpec {
  moveDocument(
    sourceUri: string,
    destParentUri: string,
    displayName: string,
  ): Promise<string>;
}

type NativeErrorLike = {
  code?: unknown;
  message?: unknown;
};

export class FileMoverError extends Error {
  readonly code: FileMoverErrorCode;

  constructor(code: FileMoverErrorCode, message: string) {
    super(message);
    this.name = 'FileMoverError';
    this.code = code;
  }
}

function getFileMoverModule(): FileMoverModuleSpec {
  const module = NativeModules.FileMoverModule as FileMoverModuleSpec | undefined;
  if (module == null) {
    throw new FileMoverError(
      'E_MODULE_UNAVAILABLE',
      ERROR_MESSAGES.E_MODULE_UNAVAILABLE,
    );
  }

  return module;
}

function toFileMoverError(error: unknown): FileMoverError {
  if (error instanceof FileMoverError) {
    return error;
  }

  const nativeError = (error ?? {}) as NativeErrorLike;
  const code =
    typeof nativeError.code === 'string' && nativeError.code in ERROR_MESSAGES
      ? (nativeError.code as FileMoverErrorCode)
      : 'E_UNKNOWN';
  const message =
    typeof nativeError.message === 'string' && nativeError.message.trim().length > 0
      ? nativeError.message
      : ERROR_MESSAGES[code];

  return new FileMoverError(code, message);
}

export async function moveDocument(
  sourceUri: string,
  destParentUri: string,
  displayName: string,
): Promise<string> {
  try {
    return await getFileMoverModule().moveDocument(
      sourceUri,
      destParentUri,
      displayName,
    );
  } catch (error) {
    throw toFileMoverError(error);
  }
}
