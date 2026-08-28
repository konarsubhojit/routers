export type CloudGranularity = 'filename' | 'filename+metadata';

export interface AppSettings {
  /** Tier 3 cloud classification is opt-in and OFF by default. */
  cloudClassificationEnabled: boolean;
  /** How much file metadata is sent when cloud classification is enabled. */
  cloudGranularity: CloudGranularity;
  /** Crash reporting is opt-out and ON by default outside of debug builds. */
  crashReportingEnabled: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  cloudClassificationEnabled: false,
  cloudGranularity: 'filename',
  crashReportingEnabled: true,
};

/**
 * Minimal persistence surface, satisfied by `@react-native-async-storage/async-storage`
 * in production and by an in-memory fake in tests.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const STORAGE_KEY = 'filesage.settings.v1';

function isCloudGranularity(value: unknown): value is CloudGranularity {
  return value === 'filename' || value === 'filename+metadata';
}

function parseSettings(raw: string | null): AppSettings {
  if (raw == null) {
    return {...DEFAULT_APP_SETTINGS};
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      cloudClassificationEnabled:
        typeof parsed.cloudClassificationEnabled === 'boolean'
          ? parsed.cloudClassificationEnabled
          : DEFAULT_APP_SETTINGS.cloudClassificationEnabled,
      cloudGranularity: isCloudGranularity(parsed.cloudGranularity)
        ? parsed.cloudGranularity
        : DEFAULT_APP_SETTINGS.cloudGranularity,
      crashReportingEnabled:
        typeof parsed.crashReportingEnabled === 'boolean'
          ? parsed.crashReportingEnabled
          : DEFAULT_APP_SETTINGS.crashReportingEnabled,
    };
  } catch {
    return {...DEFAULT_APP_SETTINGS};
  }
}

export class AppSettingsStore {
  private cached: AppSettings | null = null;

  constructor(private readonly storage: KeyValueStorage) {}

  async load(): Promise<AppSettings> {
    if (this.cached != null) {
      return this.cached;
    }

    const raw = await this.storage.getItem(STORAGE_KEY);
    this.cached = parseSettings(raw);
    return this.cached;
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.load();
    const next: AppSettings = {...current, ...partial};
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.cached = next;
    return next;
  }
}

export function createInMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    async getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    async setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}
