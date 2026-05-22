import {batchMove, BatchMoveProgressEvent} from '../../src/move/batchMove';

function makeNameConflictError(): Error & {code: string} {
  const error = new Error(
    'A document already exists in the destination folder with this name.',
  ) as Error & {code: string};
  error.code = 'E_NAME_CONFLICT';
  return error;
}

describe('batchMove', () => {
  it('returns immediately for empty input', async () => {
    const ensureChildDirectory = jest.fn();
    const moveDocument = jest.fn();
    const saveJournal = jest.fn();
    const onProgress = jest.fn<void, [BatchMoveProgressEvent]>();

    await expect(
      batchMove([], 'content://tree/root', {
        onProgress,
        dependencies: {ensureChildDirectory, moveDocument, saveJournal},
      }),
    ).resolves.toEqual({
      total: 0,
      moved: [],
      skipped: [],
      errors: [],
    });

    expect(ensureChildDirectory).not.toHaveBeenCalled();
    expect(moveDocument).not.toHaveBeenCalled();
    expect(saveJournal).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('moves every file and emits progress for successful batches', async () => {
    const ensureChildDirectory = jest.fn(async (_treeUri: string, bucket: string) => {
      return `content://tree/${bucket}`;
    });
    const moveDocument = jest.fn(
      async (sourceUri: string, destinationUri: string, displayName: string) => {
        return `${destinationUri}/${displayName}-${sourceUri.split('/').pop()}`;
      },
    );
    const saveJournal = jest.fn();
    const progressEvents: BatchMoveProgressEvent[] = [];

    const result = await batchMove(
      [
        {
          bucket: 'Docs',
          files: [
            {
              uri: 'content://docs/1',
              name: 'invoice.pdf',
              bucket: 'Docs',
            },
          ],
        },
        {
          bucket: 'Images',
          files: [
            {
              uri: 'content://images/1',
              name: 'photo.jpg',
              bucket: 'Images',
            },
            {
              uri: 'content://images/2',
              name: 'cover.png',
              bucket: 'Images',
            },
          ],
        },
      ],
      'content://tree/root',
      {
        onProgress: event => progressEvents.push(event),
        dependencies: {ensureChildDirectory, moveDocument, saveJournal},
      },
    );

    expect(ensureChildDirectory).toHaveBeenCalledTimes(2);
    expect(ensureChildDirectory).toHaveBeenNthCalledWith(
      1,
      'content://tree/root',
      'Docs',
    );
    expect(ensureChildDirectory).toHaveBeenNthCalledWith(
      2,
      'content://tree/root',
      'Images',
    );
    expect(moveDocument).toHaveBeenCalledTimes(3);
    expect(result.errors).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.moved).toHaveLength(3);
    expect(progressEvents.map(event => event.status)).toEqual([
      'moved',
      'moved',
      'moved',
    ]);
    expect(progressEvents.map(event => [event.processed, event.moved])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
    expect(saveJournal).toHaveBeenCalledTimes(1);
    expect(saveJournal).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({sourceUri: 'content://docs/1', name: 'invoice.pdf'}),
        expect.objectContaining({sourceUri: 'content://images/1', name: 'photo.jpg'}),
        expect.objectContaining({sourceUri: 'content://images/2', name: 'cover.png'}),
      ]),
    );
  });

  it('records per-file failures without aborting the rest of the batch', async () => {
    const ensureChildDirectory = jest.fn(async (_treeUri: string, bucket: string) => {
      if (bucket === 'Images') {
        throw new Error('Could not create Images');
      }
      return `content://tree/${bucket}`;
    });
    const moveDocument = jest.fn(async (sourceUri: string) => {
      if (sourceUri.endsWith('/2')) {
        throw new Error('Write denied');
      }
      return `${sourceUri}/moved`;
    });
    const saveJournal = jest.fn();
    const progressEvents: BatchMoveProgressEvent[] = [];

    const result = await batchMove(
      [
        {
          bucket: 'Docs',
          files: [
            {
              uri: 'content://docs/1',
              name: 'invoice.pdf',
              bucket: 'Docs',
            },
            {
              uri: 'content://docs/2',
              name: 'statement.pdf',
              bucket: 'Docs',
            },
          ],
        },
        {
          bucket: 'Images',
          files: [
            {
              uri: 'content://images/1',
              name: 'photo.jpg',
              bucket: 'Images',
            },
          ],
        },
      ],
      'content://tree/root',
      {
        onProgress: event => progressEvents.push(event),
        dependencies: {ensureChildDirectory, moveDocument, saveJournal},
      },
    );

    expect(result.total).toBe(3);
    expect(result.moved).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map(item => item.error.message)).toEqual([
      'Write denied',
      'Could not create Images',
    ]);
    expect(progressEvents.map(event => event.status)).toEqual([
      'moved',
      'error',
      'error',
    ]);
    expect(progressEvents.map(event => [event.processed, event.moved])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
  });

  describe('collision policies', () => {
    it('overwrite policy: surfaces name collisions as errors and continues', async () => {
      const ensureChildDirectory = jest.fn(async (_treeUri: string, bucket: string) => {
        return `content://tree/${bucket}`;
      });
      const moveDocument = jest.fn(async (sourceUri: string) => {
        if (sourceUri.endsWith('/2')) {
          throw makeNameConflictError();
        }
        return `${sourceUri}/moved`;
      });
      const saveJournal = jest.fn();

      const result = await batchMove(
        [
          {
            bucket: 'Docs',
            files: [
              {uri: 'content://docs/1', name: 'invoice.pdf', bucket: 'Docs'},
              {uri: 'content://docs/2', name: 'invoice.pdf', bucket: 'Docs'},
            ],
          },
          {
            bucket: 'Images',
            files: [{uri: 'content://images/3', name: 'photo.jpg', bucket: 'Images'}],
          },
        ],
        'content://tree/root',
        {
          collisionPolicy: 'overwrite',
          dependencies: {ensureChildDirectory, moveDocument, saveJournal},
        },
      );

      expect(result.moved).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file.uri).toBe('content://docs/2');
      expect(result.errors[0].error.message).toBe(
        'A document already exists in the destination folder with this name.',
      );
      expect(moveDocument).toHaveBeenCalledTimes(3);
    });

    it('skip policy: skips conflicting files without error and continues', async () => {
      const ensureChildDirectory = jest.fn(async (_treeUri: string, bucket: string) => {
        return `content://tree/${bucket}`;
      });
      const moveDocument = jest.fn(async (sourceUri: string) => {
        if (sourceUri.endsWith('/2')) {
          throw makeNameConflictError();
        }
        return `${sourceUri}/moved`;
      });
      const saveJournal = jest.fn();
      const progressEvents: BatchMoveProgressEvent[] = [];

      const result = await batchMove(
        [
          {
            bucket: 'Docs',
            files: [
              {uri: 'content://docs/1', name: 'invoice.pdf', bucket: 'Docs'},
              {uri: 'content://docs/2', name: 'invoice.pdf', bucket: 'Docs'},
              {uri: 'content://docs/3', name: 'report.pdf', bucket: 'Docs'},
            ],
          },
        ],
        'content://tree/root',
        {
          collisionPolicy: 'skip',
          onProgress: event => progressEvents.push(event),
          dependencies: {ensureChildDirectory, moveDocument, saveJournal},
        },
      );

      expect(result.moved).toHaveLength(2);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].file.uri).toBe('content://docs/2');
      expect(result.errors).toHaveLength(0);
      expect(moveDocument).toHaveBeenCalledTimes(3);
      expect(progressEvents.map(event => event.status)).toEqual([
        'moved',
        'skipped',
        'moved',
      ]);
      expect(progressEvents.map(event => [event.processed, event.moved])).toEqual([
        [1, 1],
        [2, 1],
        [3, 2],
      ]);
    });

    it('rename policy (default): retries with suffixed name on collision', async () => {
      const ensureChildDirectory = jest.fn(async (_treeUri: string, bucket: string) => {
        return `content://tree/${bucket}`;
      });
      const moveDocument = jest.fn(
        async (_sourceUri: string, _destUri: string, displayName: string) => {
          if (displayName === 'invoice.pdf') {
            throw makeNameConflictError();
          }
          return `content://tree/Docs/${displayName}`;
        },
      );
      const saveJournal = jest.fn();

      const result = await batchMove(
        [
          {
            bucket: 'Docs',
            files: [
              {uri: 'content://docs/1', name: 'invoice.pdf', bucket: 'Docs'},
              {uri: 'content://docs/2', name: 'invoice.pdf', bucket: 'Docs'},
            ],
          },
        ],
        'content://tree/root',
        {
          collisionPolicy: 'rename',
          dependencies: {ensureChildDirectory, moveDocument, saveJournal},
        },
      );

      // First file succeeds with original name (mock only rejects 'invoice.pdf',
      // but the first file also uses 'invoice.pdf'... wait, that means both fail on
      // first attempt. Let's check: first file → 'invoice.pdf' → conflict → retry
      // with 'invoice (1).pdf' → success. Second file → same path.
      expect(result.errors).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.moved).toHaveLength(2);

      // Both files used the renamed variant
      const movedNames = result.moved.map(s => s.destinationUri);
      expect(movedNames).toContain('content://tree/Docs/invoice (1).pdf');
    });

    it('rename policy: falls back to error if all rename attempts are exhausted', async () => {
      const ensureChildDirectory = jest.fn(async (_treeUri: string, bucket: string) => {
        return `content://tree/${bucket}`;
      });
      // Always conflict regardless of name
      const moveDocument = jest.fn(async () => {
        throw makeNameConflictError();
      });
      const saveJournal = jest.fn();

      const result = await batchMove(
        [
          {
            bucket: 'Docs',
            files: [{uri: 'content://docs/1', name: 'note.txt', bucket: 'Docs'}],
          },
        ],
        'content://tree/root',
        {
          collisionPolicy: 'rename',
          dependencies: {ensureChildDirectory, moveDocument, saveJournal},
        },
      );

      expect(result.moved).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      // 1 original attempt + 99 rename retries = 100 calls
      expect(moveDocument).toHaveBeenCalledTimes(100);
    });

    it('saves journal entries for successfully moved files', async () => {
      const ensureChildDirectory = jest.fn(async (_treeUri: string, bucket: string) => {
        return `content://tree/${bucket}`;
      });
      const moveDocument = jest.fn(async (sourceUri: string) => {
        if (sourceUri === 'content://docs/2') {
          throw new Error('Permission denied');
        }
        return `${sourceUri}/moved`;
      });
      const saveJournal = jest.fn();

      await batchMove(
        [
          {
            bucket: 'Docs',
            files: [
              {uri: 'content://docs/1', name: 'a.pdf', bucket: 'Docs'},
              {uri: 'content://docs/2', name: 'b.pdf', bucket: 'Docs'},
            ],
          },
        ],
        'content://tree/root',
        {
          dependencies: {ensureChildDirectory, moveDocument, saveJournal},
        },
      );

      expect(saveJournal).toHaveBeenCalledTimes(1);
      const [journalEntries] = saveJournal.mock.calls[0];
      expect(journalEntries).toHaveLength(1);
      expect(journalEntries[0]).toEqual({
        sourceUri: 'content://docs/1',
        destinationUri: 'content://docs/1/moved',
        name: 'a.pdf',
      });
    });
  });
});
