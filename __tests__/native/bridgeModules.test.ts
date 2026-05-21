import {NativeModules} from 'react-native';

import {
  requestTreePermission,
  requestDownloadsTreePermission,
  scanTree,
} from '../../src/native/FileScanner';
import {sha256} from '../../src/native/Hashing';
import {
  classifyPathWithAICore,
  isAICoreAvailable,
} from '../../src/native/AICoreClassifier';
import {
  classifyTextWithMediaPipe,
  isMediaPipeModelAvailable,
} from '../../src/native/MediaPipeClassifier';
import {moveDocument} from '../../src/native/fileMover';

describe('native bridge modules', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).FileScannerModule;
    delete (NativeModules as Record<string, unknown>).HashingModule;
    delete (NativeModules as Record<string, unknown>).AICoreClassifierModule;
    delete (NativeModules as Record<string, unknown>).MediaPipeClassifierModule;
    delete (NativeModules as Record<string, unknown>).FileMoverModule;
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

  it('delegates MediaPipe calls to MediaPipeClassifierModule', async () => {
    const isModelAvailableMock = jest.fn().mockResolvedValue(true);
    const classifyTextMock = jest.fn().mockResolvedValue('boarding_pass');

    (NativeModules as Record<string, unknown>).MediaPipeClassifierModule = {
      isModelAvailable: isModelAvailableMock,
      classifyText: classifyTextMock,
    };

    await expect(isMediaPipeModelAvailable()).resolves.toBe(true);
    expect(isModelAvailableMock).toHaveBeenCalledTimes(1);

    await expect(classifyTextWithMediaPipe('boarding pass')).resolves.toBe(
      'boarding_pass',
    );
    expect(classifyTextMock).toHaveBeenCalledWith('boarding pass');
  });

  it('delegates AICore calls to AICoreClassifierModule', async () => {
    const isAvailableMock = jest.fn().mockResolvedValue(true);
    const classifyPathMock = jest.fn().mockResolvedValue('temporary');

    (NativeModules as Record<string, unknown>).AICoreClassifierModule = {
      isAvailable: isAvailableMock,
      classifyPath: classifyPathMock,
    };

    await expect(isAICoreAvailable()).resolves.toBe(true);
    expect(isAvailableMock).toHaveBeenCalledTimes(1);

    await expect(classifyPathWithAICore('/storage/emulated/0/Download/ticket.pdf')).resolves.toBe(
      'temporary',
    );
    expect(classifyPathMock).toHaveBeenCalledWith(
      '/storage/emulated/0/Download/ticket.pdf',
    );
  });

  it('delegates file moves to FileMoverModule', async () => {
    const moveDocumentMock = jest
      .fn()
      .mockResolvedValue('content://tree/Docs/document/primary%3ADocs%2Finvoice.pdf');

    (NativeModules as Record<string, unknown>).FileMoverModule = {
      moveDocument: moveDocumentMock,
    };

    await expect(
      moveDocument(
        'content://tree/root/document/primary%3ADownload%2Finvoice.pdf',
        'content://tree/Docs',
        'invoice.pdf',
      ),
    ).resolves.toBe('content://tree/Docs/document/primary%3ADocs%2Finvoice.pdf');
    expect(moveDocumentMock).toHaveBeenCalledWith(
      'content://tree/root/document/primary%3ADownload%2Finvoice.pdf',
      'content://tree/Docs',
      'invoice.pdf',
    );
  });

  it('throws a clear error when native modules are unavailable', async () => {
    await expect(requestDownloadsTreePermission()).rejects.toThrow(
      'FileScannerModule is not available on this platform.',
    );
    await expect(sha256('content://downloads/public_downloads/1')).rejects.toThrow(
      'HashingModule is not available on this platform.',
    );
    await expect(isMediaPipeModelAvailable()).rejects.toThrow(
      'MediaPipeClassifierModule is not available on this platform.',
    );
    await expect(isAICoreAvailable()).rejects.toThrow(
      'AICoreClassifierModule is not available on this platform.',
    );
    await expect(
      moveDocument(
        'content://tree/root/document/primary%3ADownload%2Finvoice.pdf',
        'content://tree/Docs',
        'invoice.pdf',
      ),
    ).rejects.toThrow('FileMoverModule is not available on this platform.');
  });
});
