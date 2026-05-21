import {NativeModules} from 'react-native';

import {
  DEFAULT_DESTINATION_STRATEGY,
  FolderManagerError,
  ensureBucketDirectory,
  ensureChildDirectory,
  resolveDestinationTreeUri,
} from '../../src/native/folderManager';

describe('folderManager native bridge', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).FolderManagerModule;
  });

  it('delegates ensureChildDirectory to FolderManagerModule', async () => {
    const ensureChildDirectoryMock = jest
      .fn()
      .mockResolvedValue('content://tree/Installers');

    (NativeModules as Record<string, unknown>).FolderManagerModule = {
      ensureChildDirectory: ensureChildDirectoryMock,
    };

    await expect(
      ensureChildDirectory('content://tree/root', 'Installers'),
    ).resolves.toBe('content://tree/Installers');
    expect(ensureChildDirectoryMock).toHaveBeenCalledWith(
      'content://tree/root',
      'Installers',
    );
  });

  it('uses the selected folder by default when ensuring a bucket directory', async () => {
    const ensureChildDirectoryMock = jest
      .fn()
      .mockResolvedValue('content://tree/Archives');

    (NativeModules as Record<string, unknown>).FolderManagerModule = {
      ensureChildDirectory: ensureChildDirectoryMock,
    };

    await ensureBucketDirectory(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload',
      'Archives',
      DEFAULT_DESTINATION_STRATEGY,
    );

    expect(ensureChildDirectoryMock).toHaveBeenCalledWith(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload',
      'Archives',
    );
  });

  it('can resolve an alongside destination from a selected subtree', async () => {
    const ensureChildDirectoryMock = jest
      .fn()
      .mockResolvedValue('content://tree/Images');

    (NativeModules as Record<string, unknown>).FolderManagerModule = {
      ensureChildDirectory: ensureChildDirectoryMock,
    };

    await ensureBucketDirectory(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FTrip/document/primary%3ADownload%2FTrip',
      'Images',
      'alongside-selected-folder',
    );

    expect(ensureChildDirectoryMock).toHaveBeenCalledWith(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload',
      'Images',
    );
  });

  it('resolves the storage root as the alongside destination for a top-level folder', () => {
    expect(
      resolveDestinationTreeUri(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload',
        'alongside-selected-folder',
      ),
    ).toBe(
      'content://com.android.externalstorage.documents/tree/primary%3A/document/primary%3A',
    );
  });

  it('throws a clear error for invalid alongside tree URIs', () => {
    expect(() =>
      resolveDestinationTreeUri('content://not-a-tree', 'alongside-selected-folder'),
    ).toThrow('Cannot resolve alongside destination from an invalid SAF tree URI.');
  });

  it('maps native errors to FolderManagerError instances', async () => {
    const ensureChildDirectoryMock = jest
      .fn()
      .mockRejectedValue({code: 'E_INVALID_TREE_URI'});

    (NativeModules as Record<string, unknown>).FolderManagerModule = {
      ensureChildDirectory: ensureChildDirectoryMock,
    };

    await expect(
      ensureChildDirectory('content://invalid', 'Docs'),
    ).rejects.toEqual(
      new FolderManagerError(
        'E_INVALID_TREE_URI',
        'Provided URI is not a valid SAF tree URI.',
      ),
    );
  });

  it('throws a clear error when FolderManagerModule is unavailable', async () => {
    await expect(
      ensureChildDirectory('content://tree/root', 'Other'),
    ).rejects.toEqual(
      new FolderManagerError(
        'E_MODULE_UNAVAILABLE',
        'FolderManagerModule is not available on this platform.',
      ),
    );
  });
});
