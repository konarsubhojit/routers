import {
  getCrashlytics,
  recordError as recordFirebaseError,
  setAttributes as setFirebaseAttributes,
  setCrashlyticsCollectionEnabled as setFirebaseCollectionEnabled,
} from '@react-native-firebase/crashlytics';
import {CrashlyticsBackend} from './crashReporting';

/** Production backend wired to `@react-native-firebase/crashlytics`. */
export const firebaseCrashlyticsBackend: CrashlyticsBackend = {
  async setCrashlyticsCollectionEnabled(enabled: boolean): Promise<void> {
    await setFirebaseCollectionEnabled(getCrashlytics(), enabled);
  },
  async setAttributes(attributes: Record<string, string>): Promise<void> {
    await setFirebaseAttributes(getCrashlytics(), attributes);
  },
  recordError(error: Error, jsErrorName?: string): void {
    recordFirebaseError(getCrashlytics(), error, jsErrorName);
  },
};

export * from './crashReporting';
