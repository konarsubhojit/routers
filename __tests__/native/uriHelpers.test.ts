import {NativeModules} from 'react-native';

import {
  FileScannerErrorCode,
  isFileScannerError,
  checkManageExternalStorageGranted,
  requestManageExternalStorage,
} from '../../src/native/FileScanner';

describe('isFileScannerError', () => {
  it('returns true when error.code matches the given code', () => {
    const error = {code: 'E_PERMISSION_CANCELLED', message: 'cancelled'};
    expect(isFileScannerError(error, 'E_PERMISSION_CANCELLED')).toBe(true);
  });

  it('returns false when error.code does not match', () => {
    const error = {code: 'E_SCAN_FAILED', message: 'failed'};
    expect(isFileScannerError(error, 'E_PERMISSION_CANCELLED')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFileScannerError(null, 'E_PERMISSION_CANCELLED')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFileScannerError(undefined, 'E_PERMISSION_CANCELLED')).toBe(false);
  });

  it('returns false for a plain string error', () => {
    expect(isFileScannerError('some error', 'E_PERMISSION_CANCELLED')).toBe(false);
  });

  it('returns false for an Error instance (no .code property)', () => {
    expect(isFileScannerError(new Error('no code'), 'E_PERMISSION_CANCELLED')).toBe(false);
  });

  it('covers all defined error codes without throwing', () => {
    const codes: FileScannerErrorCode[] = [
      'E_NO_ACTIVITY',
      'E_PERMISSION_IN_PROGRESS',
      'E_PERMISSION_REQUEST_FAILED',
      'E_PERMISSION_CANCELLED',
      'E_PERSIST_PERMISSION_FAILED',
      'E_PERMISSION_DENIED',
      'E_INVALID_TREE_URI',
      'E_UNSUPPORTED_URI_SCHEME',
      'E_SCAN_FAILED',
    ];
    for (const code of codes) {
      expect(isFileScannerError({code}, code)).toBe(true);
    }
  });
});

describe('checkManageExternalStorageGranted', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).FileScannerModule;
  });

  it('delegates to the native module when available', async () => {
    const checkMock = jest.fn().mockResolvedValue(true);
    (NativeModules as Record<string, unknown>).FileScannerModule = {
      checkManageExternalStorageGranted: checkMock,
      scanTree: jest.fn().mockResolvedValue([]),
    };

    await expect(checkManageExternalStorageGranted()).resolves.toBe(true);
    expect(checkMock).toHaveBeenCalledTimes(1);
  });

  it('returns true when the native module does not expose the method (legacy build)', async () => {
    (NativeModules as Record<string, unknown>).FileScannerModule = {
      scanTree: jest.fn().mockResolvedValue([]),
    };

    await expect(checkManageExternalStorageGranted()).resolves.toBe(true);
  });
});

describe('requestManageExternalStorage', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).FileScannerModule;
  });

  it('delegates to the native module when available', async () => {
    const requestMock = jest.fn().mockResolvedValue(undefined);
    (NativeModules as Record<string, unknown>).FileScannerModule = {
      requestManageExternalStorage: requestMock,
      scanTree: jest.fn().mockResolvedValue([]),
    };

    await expect(requestManageExternalStorage()).resolves.toBeUndefined();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('resolves without error when the native module does not expose the method (legacy build)', async () => {
    (NativeModules as Record<string, unknown>).FileScannerModule = {
      scanTree: jest.fn().mockResolvedValue([]),
    };

    await expect(requestManageExternalStorage()).resolves.toBeUndefined();
  });
});
