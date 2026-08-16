import {
  createCrashReporter,
  CrashlyticsBackend,
  CustomKeys,
  redactMessage,
  sanitizeContext,
  shouldEnableCrashReporting,
} from '../../src/crash/crashReporting';

function createFakeBackend(): CrashlyticsBackend & {
  attributes: Record<string, string>[];
  recorded: {error: Error; jsErrorName?: string}[];
  collectionEnabled: boolean[];
} {
  const attributes: Record<string, string>[] = [];
  const recorded: {error: Error; jsErrorName?: string}[] = [];
  const collectionEnabled: boolean[] = [];

  return {
    attributes,
    recorded,
    collectionEnabled,
    async setCrashlyticsCollectionEnabled(enabled: boolean) {
      collectionEnabled.push(enabled);
    },
    async setAttributes(attrs: Record<string, string>) {
      attributes.push(attrs);
    },
    recordError(error: Error, jsErrorName?: string) {
      recorded.push({error, jsErrorName});
    },
  };
}

describe('sanitizeContext', () => {
  it('drops any key not on the structural metadata allow-list', () => {
    const sanitized = sanitizeContext({
      fileCountBucket: '1-10',
      fileName: 'secret-diary.txt',
      filePath: '/storage/emulated/0/Download/secret-diary.txt',
      folderName: 'Download',
    });

    expect(sanitized).toEqual({fileCountBucket: '1-10'});
  });

  it('rejects allow-listed-looking values that resemble a path or file name', () => {
    const sanitized = sanitizeContext({
      errorName: '/storage/emulated/0/passport.pdf',
      errorCode: 'ENOENT',
    });

    expect(sanitized).toEqual({errorCode: 'ENOENT'});
  });
});

describe('redactMessage', () => {
  it('redacts path-like tokens from free-text error messages', () => {
    expect(redactMessage('Failed to move /storage/emulated/0/Download/report.pdf')).toBe(
      'Failed to move [redacted]',
    );
    expect(redactMessage('content://com.android.externalstorage/tree/foo failed')).toBe(
      '[redacted] failed',
    );
  });

  it('leaves plain structural text untouched', () => {
    expect(redactMessage('SAF permission was revoked by the user')).toBe(
      'SAF permission was revoked by the user',
    );
  });
});

describe('createCrashReporter', () => {
  it('never forwards file names, paths, or folder names to the backend', async () => {
    const backend = createFakeBackend();
    const reporter = createCrashReporter(backend, {enabled: true});

    await reporter.recordNonFatal(
      'file-move-failed',
      new Error('Could not move /storage/emulated/0/Download/tax-return.pdf'),
      {
        fileName: 'tax-return.pdf',
        filePath: '/storage/emulated/0/Download/tax-return.pdf',
        folderName: 'Download',
        collisionPolicy: 'rename',
      },
    );

    expect(backend.recorded).toHaveLength(1);
    const [{error, jsErrorName}] = backend.recorded;

    const serializedReport = `${error.message} ${jsErrorName ?? ''}`;
    expect(serializedReport).not.toContain('tax-return.pdf');
    expect(serializedReport).not.toContain('/storage/emulated/0/Download');
    expect(serializedReport).not.toContain('Download');

    const context = JSON.parse(jsErrorName ?? '{}');
    expect(context).toEqual({category: 'file-move-failed', collisionPolicy: 'rename'});
  });

  it('does not record anything while disabled', async () => {
    const backend = createFakeBackend();
    const reporter = createCrashReporter(backend, {enabled: false});

    await reporter.recordNonFatal('hash-failed', new Error('boom'));
    await reporter.setCustomKeys({fileCountBucket: '1-10'});

    expect(backend.recorded).toHaveLength(0);
    expect(backend.attributes).toHaveLength(0);
  });

  it('stringifies only the known custom keys', async () => {
    const backend = createFakeBackend();
    const reporter = createCrashReporter(backend, {enabled: true});

    const keys: CustomKeys = {
      fileCountBucket: '11-100',
      collisionPolicy: 'skip',
      androidApiLevel: 34,
      modelVersion: '3',
      cloudTierEnabled: true,
    };
    await reporter.setCustomKeys(keys);

    expect(backend.attributes).toEqual([
      {
        fileCountBucket: '11-100',
        collisionPolicy: 'skip',
        androidApiLevel: '34',
        modelVersion: '3',
        cloudTierEnabled: 'true',
      },
    ]);
  });

  it('honours setCrashlyticsCollectionEnabled toggling at runtime', async () => {
    const backend = createFakeBackend();
    const reporter = createCrashReporter(backend, {enabled: false});

    await reporter.recordNonFatal('classification-failed', new Error('nope'));
    expect(backend.recorded).toHaveLength(0);

    await reporter.setCrashlyticsCollectionEnabled(true);
    await reporter.recordNonFatal('classification-failed', new Error('nope'));
    expect(backend.recorded).toHaveLength(1);
    expect(backend.collectionEnabled).toEqual([true]);
  });
});

describe('shouldEnableCrashReporting', () => {
  it('is always disabled for debug builds regardless of the user setting', () => {
    expect(shouldEnableCrashReporting(true, true)).toBe(false);
    expect(shouldEnableCrashReporting(true, false)).toBe(false);
  });

  it('honours the user opt-out for non-debug builds', () => {
    expect(shouldEnableCrashReporting(false, true)).toBe(true);
    expect(shouldEnableCrashReporting(false, false)).toBe(false);
  });
});
