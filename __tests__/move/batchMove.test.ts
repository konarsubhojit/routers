import {batchMove, BatchMoveProgressEvent} from '../../src/move/batchMove';

describe('batchMove', () => {
  it('returns immediately for empty input', async () => {
    const ensureChildDirectory = jest.fn();
    const moveDocument = jest.fn();
    const onProgress = jest.fn<void, [BatchMoveProgressEvent]>();

    await expect(
      batchMove([], 'content://tree/root', {
        onProgress,
        dependencies: {ensureChildDirectory, moveDocument},
      }),
    ).resolves.toEqual({
      total: 0,
      moved: [],
      errors: [],
    });

    expect(ensureChildDirectory).not.toHaveBeenCalled();
    expect(moveDocument).not.toHaveBeenCalled();
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
        dependencies: {ensureChildDirectory, moveDocument},
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
        dependencies: {ensureChildDirectory, moveDocument},
      },
    );

    expect(result.total).toBe(3);
    expect(result.moved).toHaveLength(1);
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

  it('surfaces name collisions and continues moving later files', async () => {
    const ensureChildDirectory = jest.fn(async (_treeUri: string, bucket: string) => {
      return `content://tree/${bucket}`;
    });
    const moveDocument = jest.fn(async (sourceUri: string) => {
      if (sourceUri.endsWith('/2')) {
        const error = new Error(
          'A document already exists in the destination folder with this name.',
        );
        (error as Error & {code?: string}).code = 'E_NAME_CONFLICT';
        throw error;
      }
      return `${sourceUri}/moved`;
    });

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
              name: 'invoice.pdf',
              bucket: 'Docs',
            },
          ],
        },
        {
          bucket: 'Images',
          files: [
            {
              uri: 'content://images/3',
              name: 'photo.jpg',
              bucket: 'Images',
            },
          ],
        },
      ],
      'content://tree/root',
      {
        dependencies: {ensureChildDirectory, moveDocument},
      },
    );

    expect(result.moved).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file.uri).toBe('content://docs/2');
    expect(result.errors[0].error.message).toBe(
      'A document already exists in the destination folder with this name.',
    );
    expect(moveDocument).toHaveBeenCalledTimes(3);
  });
});
