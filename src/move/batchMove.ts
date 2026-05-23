import {ensureChildDirectory} from '../native/folderManager';
import {moveDocument} from '../native/fileMover';
import {ExtensionBucket} from '../preprocess/extensionBuckets';
import {
  CollisionPolicy,
  DEFAULT_COLLISION_POLICY,
  resolveCollisionName,
} from './collisionPolicy';
import {JournalEntry, saveJournal} from './moveJournal';

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
  status: 'moved' | 'skipped' | 'error';
  file: BatchMoveFile;
  error?: Error;
}

export interface BatchMoveSuccess {
  file: BatchMoveFile;
  destinationUri: string;
  /** The actual display name used for the move (may differ from file.name when renamed). */
  resolvedName: string;
}

export interface BatchMoveSkip {
  file: BatchMoveFile;
}

export interface BatchMoveFailure {
  file: BatchMoveFile;
  error: Error;
}

export interface BatchMoveResult {
  total: number;
  moved: BatchMoveSuccess[];
  skipped: BatchMoveSkip[];
  errors: BatchMoveFailure[];
}

interface BatchMoveDependencies {
  ensureChildDirectory: typeof ensureChildDirectory;
  moveDocument: typeof moveDocument;
  saveJournal: typeof saveJournal;
}

interface BatchMoveOptions {
  onProgress?: (event: BatchMoveProgressEvent) => void;
  collisionPolicy?: CollisionPolicy;
  dependencies?: Partial<BatchMoveDependencies>;
}

/** Maximum rename attempts for the 'rename' collision policy. */
const MAX_RENAME_ATTEMPTS = 99;

const DEFAULT_DEPENDENCIES: BatchMoveDependencies = {
  ensureChildDirectory,
  moveDocument,
  saveJournal,
};

export async function batchMove(
  groups: BatchMoveGroup[],
  selectedTreeUri: string,
  options: BatchMoveOptions = {},
): Promise<BatchMoveResult> {
  const {onProgress, collisionPolicy = DEFAULT_COLLISION_POLICY} = options;
  const dependencies: BatchMoveDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...options.dependencies,
  };
  const total = groups.reduce((sum, group) => sum + group.files.length, 0);

  if (total === 0) {
    return {total, moved: [], skipped: [], errors: []};
  }

  const moved: BatchMoveSuccess[] = [];
  const skipped: BatchMoveSkip[] = [];
  const errors: BatchMoveFailure[] = [];

  const emitProgress = (
    file: BatchMoveFile,
    status: 'moved' | 'skipped' | 'error',
    error?: Error,
  ) => {
    onProgress?.({
      total,
      processed: moved.length + skipped.length + errors.length,
      moved: moved.length,
      status,
      file,
      error,
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
        emitProgress(file, 'error', normalizedError);
      }
      continue;
    }

    for (const file of group.files) {
      const maxAttempts =
        collisionPolicy === 'rename' ? MAX_RENAME_ATTEMPTS + 1 : 1;
      let destinationUri: string | null = null;
      let resolvedName = file.name;
      let fileSkipped = false;
      let fileError: Error | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const targetName =
          attempt === 0 ? file.name : resolveCollisionName(file.name, attempt);

        try {
          destinationUri = await dependencies.moveDocument(
            file.uri,
            destinationBucketUri,
            targetName,
          );
          resolvedName = targetName;
          break;
        } catch (error) {
          if (isNameConflict(error)) {
            if (collisionPolicy === 'rename' && attempt < maxAttempts - 1) {
              continue;
            }
            if (collisionPolicy === 'skip') {
              fileSkipped = true;
              break;
            }
          }
          fileError = toError(error);
          break;
        }
      }

      if (destinationUri != null) {
        moved.push({file, destinationUri, resolvedName});
        emitProgress(file, 'moved');
      } else if (fileSkipped) {
        skipped.push({file});
        emitProgress(file, 'skipped');
      } else {
        const normalizedError = fileError ?? new Error('File move failed.');
        errors.push({file, error: normalizedError});
        emitProgress(file, 'error', normalizedError);
      }
    }
  }

  const journalEntries: JournalEntry[] = moved.map(success => ({
    sourceUri: success.file.uri,
    destinationUri: success.destinationUri,
    name: success.file.name,
    resolvedName: success.resolvedName,
  }));
  dependencies.saveJournal(journalEntries);

  return {total, moved, skipped, errors};
}

function isNameConflict(error: unknown): boolean {
  return (
    typeof (error as {code?: unknown}).code === 'string' &&
    (error as {code: string}).code === 'E_NAME_CONFLICT'
  );
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
