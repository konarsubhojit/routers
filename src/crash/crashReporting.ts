/**
 * Structural-only telemetry categories. Never include file names, paths,
 * folder names, or file contents anywhere in this module: only bucketed
 * counts, enums, and booleans are allowed to flow into crash reports.
 */
export type NonFatalCategory =
  | 'saf-permission-lost'
  | 'file-move-failed'
  | 'hash-failed'
  | 'model-load-failed'
  | 'model-download-failed'
  | 'classification-failed';

export type CollisionPolicy = 'rename' | 'skip' | 'overwrite';

export interface CustomKeys {
  /** Bucketed, never an exact count (e.g. "1-10", "11-100", "100+"). */
  fileCountBucket?: string;
  collisionPolicy?: CollisionPolicy;
  androidApiLevel?: number;
  modelVersion?: string;
  cloudTierEnabled?: boolean;
}

/**
 * Fields explicitly allowed in non-fatal report context. Anything not in
 * this list is stripped by `sanitizeContext` before it ever reaches the
 * crash reporting backend.
 */
const ALLOWED_CONTEXT_KEYS = new Set([
  'category',
  'tier',
  'errorCode',
  'errorName',
  'fileCountBucket',
  'collisionPolicy',
  'androidApiLevel',
  'modelVersion',
  'cloudTierEnabled',
  'httpStatus',
]);

/** Keys/values that look like they could contain a path or file name. */
const PATH_LIKE_PATTERN = /[\\/]|\.[a-z0-9]{1,5}$/i;

function looksPathLike(value: string): boolean {
  return PATH_LIKE_PATTERN.test(value);
}

/**
 * Redacts any whitespace-delimited token in a free-text error message that
 * looks like it could be a path, URI, or file name (contains a slash,
 * backslash, or a trailing file extension). Applied to every non-fatal
 * message before it leaves the device.
 */
export function redactMessage(message: string): string {
  return message
    .split(/\s+/)
    .map(token => (looksPathLike(token) ? '[redacted]' : token))
    .join(' ');
}

/**
 * Strips any context field that is not explicitly allow-listed, and further
 * rejects any remaining string value that looks like it could be a path or
 * file name (defense in depth). This is the single choke point all crash
 * telemetry must pass through.
 */
export function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (!ALLOWED_CONTEXT_KEYS.has(key)) {
      continue;
    }

    if (typeof value === 'string' && looksPathLike(value)) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export interface CrashReporter {
  setCrashlyticsCollectionEnabled(enabled: boolean): Promise<void>;
  setCustomKeys(keys: CustomKeys): Promise<void>;
  recordNonFatal(category: NonFatalCategory, error: Error, context?: Record<string, unknown>): Promise<void>;
}

/** Backend surface implemented by `@react-native-firebase/crashlytics`. */
export interface CrashlyticsBackend {
  setCrashlyticsCollectionEnabled(enabled: boolean): Promise<void>;
  setAttributes(attributes: Record<string, string>): Promise<void>;
  recordError(error: Error, jsErrorName?: string): void;
}

function stringifyCustomKeys(keys: CustomKeys): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (keys.fileCountBucket != null) {
    attributes.fileCountBucket = keys.fileCountBucket;
  }
  if (keys.collisionPolicy != null) {
    attributes.collisionPolicy = keys.collisionPolicy;
  }
  if (keys.androidApiLevel != null) {
    attributes.androidApiLevel = String(keys.androidApiLevel);
  }
  if (keys.modelVersion != null) {
    attributes.modelVersion = keys.modelVersion;
  }
  if (keys.cloudTierEnabled != null) {
    attributes.cloudTierEnabled = String(keys.cloudTierEnabled);
  }
  return attributes;
}

export function createCrashReporter(
  backend: CrashlyticsBackend,
  options: {enabled: boolean} = {enabled: true},
): CrashReporter {
  let enabled = options.enabled;

  return {
    async setCrashlyticsCollectionEnabled(nextEnabled: boolean): Promise<void> {
      enabled = nextEnabled;
      await backend.setCrashlyticsCollectionEnabled(nextEnabled);
    },

    async setCustomKeys(keys: CustomKeys): Promise<void> {
      if (!enabled) {
        return;
      }
      await backend.setAttributes(stringifyCustomKeys(keys));
    },

    async recordNonFatal(
      category: NonFatalCategory,
      error: Error,
      context: Record<string, unknown> = {},
    ): Promise<void> {
      if (!enabled) {
        return;
      }

      const sanitized = sanitizeContext({...context, category});
      const wrapped = new Error(`[${category}] ${redactMessage(error.message)}`);
      backend.recordError(wrapped, JSON.stringify(sanitized));
    },
  };
}

/**
 * Determines whether crash reporting should be enabled on init: disabled in
 * debug builds regardless of the user setting, and otherwise honours the
 * user's opt-out setting (default ON, see `DEFAULT_APP_SETTINGS`).
 */
export function shouldEnableCrashReporting(isDebugBuild: boolean, userOptedIn: boolean): boolean {
  if (isDebugBuild) {
    return false;
  }
  return userOptedIn;
}

export async function initCrashReporter(
  reporter: CrashReporter,
  options: {isDebugBuild: boolean; userOptedIn: boolean},
): Promise<void> {
  const enabled = shouldEnableCrashReporting(options.isDebugBuild, options.userOptedIn);
  await reporter.setCrashlyticsCollectionEnabled(enabled);
}
