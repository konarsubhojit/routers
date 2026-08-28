import {createCrashReporter} from './crashReporting';
import {firebaseCrashlyticsBackend} from './index';

/**
 * App-wide singleton crash reporter, wired to the real Firebase Crashlytics
 * backend. Starts disabled; `App.tsx` calls `initCrashReporter` on mount to
 * enable it based on build type + the user's opt-out setting.
 */
export const crashReporter = createCrashReporter(firebaseCrashlyticsBackend, {
  enabled: false,
});
