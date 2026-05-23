import {moveDocument} from '../native/fileMover';
import {JournalEntry, MoveJournal, clearJournal, loadJournal} from './moveJournal';

export interface UndoMoveSuccess {
  entry: JournalEntry;
  restoredUri: string;
}

export interface UndoMoveFailure {
  entry: JournalEntry;
  error: Error;
}

export interface UndoMoveResult {
  total: number;
  restored: UndoMoveSuccess[];
  errors: UndoMoveFailure[];
}

interface UndoMoveDependencies {
  moveDocument: typeof moveDocument;
  loadJournal: () => MoveJournal | null;
  clearJournal: () => void;
}

interface UndoMoveOptions {
  dependencies?: Partial<UndoMoveDependencies>;
}

const DEFAULT_DEPENDENCIES: UndoMoveDependencies = {
  moveDocument,
  loadJournal,
  clearJournal,
};

/**
 * Reverses the last batch move by moving each file from its destination back
 * to the original parent directory with the original display name.
 *
 * This is best-effort: individual failures are collected in `errors` while the
 * rest of the entries are still attempted.  After a successful replay the
 * journal is cleared so a second undo cannot be triggered.
 */
export async function undoLastMove(
  options: UndoMoveOptions = {},
): Promise<UndoMoveResult> {
  const deps: UndoMoveDependencies = {...DEFAULT_DEPENDENCIES, ...options.dependencies};

  const journal = deps.loadJournal();
  if (journal == null || journal.entries.length === 0) {
    return {total: 0, restored: [], errors: []};
  }

  const {entries} = journal;
  const total = entries.length;
  const restored: UndoMoveSuccess[] = [];
  const errors: UndoMoveFailure[] = [];

  for (const entry of entries) {
    const originalParentUri = getParentTreeUriFromDocumentUri(entry.sourceUri);
    if (originalParentUri == null) {
      errors.push({
        entry,
        error: new Error(
          `Cannot derive original parent URI from: ${entry.sourceUri}`,
        ),
      });
      continue;
    }

    try {
      const restoredUri = await deps.moveDocument(
        entry.destinationUri,
        originalParentUri,
        entry.name,
      );
      restored.push({entry, restoredUri});
    } catch (error) {
      errors.push({entry, error: toError(error)});
    }
  }

  deps.clearJournal();

  return {total, restored, errors};
}

/**
 * Derives the parent tree URI from a SAF document URI.
 *
 * SAF document URIs have the form:
 *   content://<authority>/document/<encodedDocId>
 * where a decoded docId looks like "primary:Download/photo.jpg".
 *
 * The returned tree URI takes the form:
 *   content://<authority>/tree/<encodedParentDocId>/document/<encodedParentDocId>
 *
 * Returns null when the URI cannot be parsed or the document is at the root.
 */
export function getParentTreeUriFromDocumentUri(documentUri: string): string | null {
  const match = documentUri.match(
    /^(content:\/\/[^/]+)\/document\/([^/?#]+)(.*)$/,
  );
  if (match == null) {
    return null;
  }

  const [, origin, encodedDocId] = match;
  const docId = decodeURIComponent(encodedDocId);

  const separatorIndex = docId.indexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  const rootPrefix = docId.slice(0, separatorIndex + 1);
  const relativePath = docId.slice(separatorIndex + 1);
  if (relativePath.length === 0) {
    return null;
  }

  const lastSlashIndex = relativePath.lastIndexOf('/');
  const parentDocId =
    lastSlashIndex < 0
      ? rootPrefix
      : `${rootPrefix}${relativePath.slice(0, lastSlashIndex)}`;

  const encodedParent = encodeURIComponent(parentDocId);
  return `${origin}/tree/${encodedParent}/document/${encodedParent}`;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return new Error(error);
  }
  return new Error('Undo move failed.');
}
