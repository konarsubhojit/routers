import {NativeModules} from 'react-native';

import {
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
    const requestDownloadsTreePermissionMock = jest
      .fn()
      .mockResolvedValue('content://tree/downloads');
    const scanTreeMock = jest.fn().mockResolvedValue([
      {
        uri: 'content://downloads/public_downloads/1',
        name: 'invoice.pdf',
        sizeBytes: 1024,
        mtime: 1715000000000,
        mimeType: 'application/pdf',
      },
    ]);

    (NativeModules as Record<string, unknown>).FileScannerModule = {
      requestDownloadsTreePermission: requestDownloadsTreePermissionMock,
      scanTree: scanTreeMock,
    };

    await expect(requestDownloadsTreePermission()).resolves.toBe(
      'content://tree/downloads',
    );
    await expect(scanTree('content://tree/downloads')).resolves.toEqual([
      {
        uri: 'content://downloads/public_downloads/1',
        name: 'invoice.pdf',
        sizeBytes: 1024,
        mtime: 1715000000000,
        mimeType: 'application/pdf',
      },
    ]);

    expect(requestDownloadsTreePermissionMock).toHaveBeenCalledTimes(1);
    expect(scanTreeMock).toHaveBeenCalledWith('content://tree/downloads');
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
