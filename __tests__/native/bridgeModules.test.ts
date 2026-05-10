import {NativeModules} from 'react-native';

import {
  requestTreePermission,
  requestDownloadsTreePermission,
  scanTree,
} from '../../src/native/FileScanner';
import {sha256} from '../../src/native/Hashing';

describe('native bridge modules', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).FileScannerModule;
    delete (NativeModules as Record<string, unknown>).HashingModule;
  });

  it('delegates FileScanner calls to FileScannerModule', async () => {
    const requestTreePermissionMock = jest.fn().mockResolvedValue('content://tree/folder');
    const scanTreeMock = jest.fn().mockResolvedValue([
      {
        uri: 'content://com.example.documents/tree/1',
        name: 'invoice.pdf',
        sizeBytes: 1024,
        mtime: 1715000000000,
        mimeType: 'application/pdf',
      },
    ]);

    (NativeModules as Record<string, unknown>).FileScannerModule = {
      requestTreePermission: requestTreePermissionMock,
      scanTree: scanTreeMock,
    };

    await expect(requestTreePermission()).resolves.toBe('content://tree/folder');
    expect(requestTreePermissionMock).toHaveBeenCalledTimes(1);

    await expect(requestDownloadsTreePermission()).resolves.toBe(
      'content://tree/folder',
    );
    expect(requestTreePermissionMock).toHaveBeenCalledTimes(2);

    await expect(scanTree('content://tree/folder')).resolves.toEqual([
      {
        uri: 'content://com.example.documents/tree/1',
        name: 'invoice.pdf',
        sizeBytes: 1024,
        mtime: 1715000000000,
        mimeType: 'application/pdf',
      },
    ]);

    expect(scanTreeMock).toHaveBeenCalledWith('content://tree/folder');
  });

  it('falls back to requestDownloadsTreePermission when requestTreePermission is missing', async () => {
    const requestDownloadsTreePermissionMock = jest
      .fn()
      .mockResolvedValue('content://tree/fallback');

    (NativeModules as Record<string, unknown>).FileScannerModule = {
      requestDownloadsTreePermission: requestDownloadsTreePermissionMock,
      scanTree: jest.fn().mockResolvedValue([]),
    };

    await expect(requestTreePermission()).resolves.toBe('content://tree/fallback');
    expect(requestDownloadsTreePermissionMock).toHaveBeenCalledTimes(1);
  });

  it('delegates hashing calls to HashingModule', async () => {
    const sha256Mock = jest.fn().mockResolvedValue('abc123');

    (NativeModules as Record<string, unknown>).HashingModule = {
      sha256: sha256Mock,
    };

    await expect(sha256('content://downloads/public_downloads/1')).resolves.toBe(
      'abc123',
    );
    expect(sha256Mock).toHaveBeenCalledWith(
      'content://downloads/public_downloads/1',
    );
  });

  it('throws a clear error when native modules are unavailable', async () => {
    await expect(requestDownloadsTreePermission()).rejects.toThrow(
      'FileScannerModule is not available on this platform.',
    );
    await expect(sha256('content://downloads/public_downloads/1')).rejects.toThrow(
      'HashingModule is not available on this platform.',
    );
  });
});
