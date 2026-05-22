export interface JournalEntry {
  /** Original URI of the file before the move. */
  sourceUri: string;
  /** URI of the file after the move (its current location). */
  destinationUri: string;
  /** Original display name of the file. */
  name: string;
}

export interface MoveJournal {
  entries: JournalEntry[];
  /** Unix timestamp (ms) when the batch was saved. */
  timestamp: number;
}

let _lastJournal: MoveJournal | null = null;

/**
 * Persists the journal for the most recent batch move.
 * Clears any previously stored journal.
 * If entries is empty the journal is cleared rather than saved.
 */
export function saveJournal(entries: JournalEntry[]): void {
  _lastJournal = entries.length > 0 ? {entries, timestamp: Date.now()} : null;
}

/** Returns the journal for the last batch move, or null if none exists. */
export function loadJournal(): MoveJournal | null {
  return _lastJournal;
}

/** Clears the stored journal. */
export function clearJournal(): void {
  _lastJournal = null;
}
