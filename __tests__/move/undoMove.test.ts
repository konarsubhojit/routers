import {getParentTreeUriFromDocumentUri, undoLastMove} from '../../src/move/undoMove';
import {JournalEntry, MoveJournal} from '../../src/move/moveJournal';

function makeJournal(entries: JournalEntry[]): MoveJournal {
  return {entries, timestamp: Date.now()};
}

describe('getParentTreeUriFromDocumentUri', () => {
  it('derives the parent tree URI for a nested document', () => {
    expect(
      getParentTreeUriFromDocumentUri(
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fphoto.jpg',
      ),
    ).toBe(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload',
    );
  });

  it('derives the parent tree URI one level up from a sub-folder', () => {
    expect(
      getParentTreeUriFromDocumentUri(
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2FTrip%2Fphoto.jpg',
      ),
    ).toBe(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FTrip/document/primary%3ADownload%2FTrip',
    );
  });

  it('derives the root-level parent (no slash in relative path)', () => {
    // docId = "primary:photo.jpg" → parent = "primary:"
    expect(
      getParentTreeUriFromDocumentUri(
        'content://com.android.externalstorage.documents/document/primary%3Aphoto.jpg',
      ),
    ).toBe(
      'content://com.android.externalstorage.documents/tree/primary%3A/document/primary%3A',
    );
  });

  it('returns null for URIs without /document/ segment', () => {
    expect(getParentTreeUriFromDocumentUri('content://tree/root')).toBeNull();
  });

  it('returns null for URIs where the document ID has no colon separator', () => {
    expect(
      getParentTreeUriFromDocumentUri(
        'content://com.android.externalstorage.documents/document/nodocid',
      ),
    ).toBeNull();
  });

  it('returns null when the document ID has nothing after the root prefix', () => {
    // docId = "primary:" → relativePath is empty
    expect(
      getParentTreeUriFromDocumentUri(
        'content://com.android.externalstorage.documents/document/primary%3A',
      ),
    ).toBeNull();
  });
});

describe('undoLastMove', () => {
  it('returns empty result when there is no journal', async () => {
    const moveDocument = jest.fn();
    const loadJournal = jest.fn().mockReturnValue(null);
    const clearJournal = jest.fn();

    const result = await undoLastMove({
      dependencies: {moveDocument, loadJournal, clearJournal},
    });

    expect(result).toEqual({total: 0, restored: [], errors: []});
    expect(moveDocument).not.toHaveBeenCalled();
    expect(clearJournal).not.toHaveBeenCalled();
  });

  it('moves each file back to the original parent and clears the journal', async () => {
    const entry: JournalEntry = {
      sourceUri:
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2Finvoice.pdf',
      destinationUri:
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2FDocs%2Finvoice.pdf',
      name: 'invoice.pdf',
      resolvedName: 'invoice.pdf',
    };
    const moveDocument = jest
      .fn()
      .mockResolvedValue(
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2Finvoice.pdf',
      );
    const loadJournal = jest.fn().mockReturnValue(makeJournal([entry]));
    const clearJournal = jest.fn();

    const result = await undoLastMove({
      dependencies: {moveDocument, loadJournal, clearJournal},
    });

    expect(result.total).toBe(1);
    expect(result.restored).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.restored[0].entry).toBe(entry);
    expect(result.restored[0].restoredUri).toBe(
      'content://com.android.externalstorage.documents/document/primary%3ADownload%2Finvoice.pdf',
    );

    // Should have called moveDocument with (destinationUri, originalParentTreeUri, name)
    expect(moveDocument).toHaveBeenCalledWith(
      entry.destinationUri,
      'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload',
      'invoice.pdf',
    );

    expect(clearJournal).toHaveBeenCalledTimes(1);
  });

  it('collects individual failures and still clears the journal', async () => {
    const goodEntry: JournalEntry = {
      sourceUri:
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fa.pdf',
      destinationUri:
        'content://com.android.externalstorage.documents/document/primary%3ADocs%2Fa.pdf',
      name: 'a.pdf',
      resolvedName: 'a.pdf',
    };
    const badEntry: JournalEntry = {
      sourceUri:
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fb.pdf',
      destinationUri:
        'content://com.android.externalstorage.documents/document/primary%3ADocs%2Fb.pdf',
      name: 'b.pdf',
      resolvedName: 'b.pdf',
    };
    const moveDocument = jest.fn().mockImplementation(
      async (sourceUri: string) => {
        if (sourceUri.includes('b.pdf')) {
          throw new Error('Permission denied');
        }
        return `${sourceUri}/restored`;
      },
    );
    const loadJournal = jest
      .fn()
      .mockReturnValue(makeJournal([goodEntry, badEntry]));
    const clearJournal = jest.fn();

    const result = await undoLastMove({
      dependencies: {moveDocument, loadJournal, clearJournal},
    });

    expect(result.total).toBe(2);
    expect(result.restored).toHaveLength(1);
    expect(result.restored[0].entry).toBe(goodEntry);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entry).toBe(badEntry);
    expect(result.errors[0].error.message).toBe('Permission denied');
    expect(clearJournal).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error when the source URI cannot be parsed', async () => {
    const entry: JournalEntry = {
      sourceUri: 'not-a-valid-uri',
      destinationUri: 'content://somewhere/document/primary%3Adest.pdf',
      name: 'dest.pdf',
      resolvedName: 'dest.pdf',
    };
    const moveDocument = jest.fn();
    const loadJournal = jest.fn().mockReturnValue(makeJournal([entry]));
    const clearJournal = jest.fn();

    const result = await undoLastMove({
      dependencies: {moveDocument, loadJournal, clearJournal},
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error.message).toContain(
      'Cannot derive original parent URI from: not-a-valid-uri',
    );
    expect(moveDocument).not.toHaveBeenCalled();
    expect(clearJournal).toHaveBeenCalledTimes(1);
  });
});
