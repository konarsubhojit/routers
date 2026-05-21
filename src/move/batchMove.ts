import {ensureChildDirectory} from '../native/folderManager';
import {moveDocument} from '../native/fileMover';
import {ExtensionBucket} from '../preprocess/extensionBuckets';

export interface BatchMoveFile {
  uri: string;
  name: string;
  bucket: ExtensionBucket;
}

export interface BatchMoveGroup {
  bucket: ExtensionBucket;
  files: BatchMoveFile[];
}

export interface BatchMoveProgressEvent {
  total: number;
  processed: number;
  moved: number;
  status: 'moved' | 'error';
  file: BatchMoveFile;
  error?: Error;
}

export interface BatchMoveSuccess {
  file: BatchMoveFile;
  destinationUri: string;
}

export interface BatchMoveFailure {
  file: BatchMoveFile;
  error: Error;
}

export interface BatchMoveResult {
  total: number;
  moved: BatchMoveSuccess[];
  errors: BatchMoveFailure[];
}

interface BatchMoveDependencies {
  ensureChildDirectory: typeof ensureChildDirectory;
  moveDocument: typeof moveDocument;
}

interface BatchMoveOptions {
  onProgress?: (event: BatchMoveProgressEvent) => void;
  dependencies?: Partial<BatchMoveDependencies>;
}

const DEFAULT_DEPENDENCIES: BatchMoveDependencies = {
  ensureChildDirectory,
  moveDocument,
};

export async function batchMove(
  groups: BatchMoveGroup[],
  selectedTreeUri: string,
  options: BatchMoveOptions = {},
): Promise<BatchMoveResult> {
  const {onProgress} = options;
  const dependencies: BatchMoveDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...options.dependencies,
  };
  const total = groups.reduce((sum, group) => sum + group.files.length, 0);

  if (total === 0) {
    return {total, moved: [], errors: []};
  }

  const moved: BatchMoveSuccess[] = [];
  const errors: BatchMoveFailure[] = [];

  const emitProgress = (file: BatchMoveFile, error?: unknown) => {
    const normalizedError = error == null ? undefined : toError(error);
    onProgress?.({
      total,
      processed: moved.length + errors.length,
      moved: moved.length,
      status: normalizedError == null ? 'moved' : 'error',
      file,
      error: normalizedError,
    });
  };

  for (const group of groups) {
    let destinationBucketUri: string;

    try {
      destinationBucketUri = await dependencies.ensureChildDirectory(
        selectedTreeUri,
        group.bucket,
      );
    } catch (error) {
      for (const file of group.files) {
        const normalizedError = toError(error);
        errors.push({file, error: normalizedError});
        emitProgress(file, normalizedError);
      }
      continue;
    }

    for (const file of group.files) {
      try {
        const destinationUri = await dependencies.moveDocument(
          file.uri,
          destinationBucketUri,
          file.name,
        );
        moved.push({file, destinationUri});
        emitProgress(file);
      } catch (error) {
        const normalizedError = toError(error);
        errors.push({file, error: normalizedError});
        emitProgress(file, normalizedError);
      }
    }
  }

  return {total, moved, errors};
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return new Error(error);
  }

  return new Error('File move failed.');
}
