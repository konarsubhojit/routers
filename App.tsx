import {useEffect} from 'react';
import {Platform, StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {crashReporter} from './src/crash/appCrashReporter';
import {initCrashReporter} from './src/crash/crashReporting';
import {ScanFlow} from './src/screens/ScanFlow';
import {appSettingsStore} from './src/settings';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    appSettingsStore.load().then(async settings => {
      await initCrashReporter(crashReporter, {
        isDebugBuild: __DEV__,
        userOptedIn: settings.crashReportingEnabled,
      });
      await crashReporter.setCustomKeys({
        androidApiLevel:
          Platform.OS === 'android' ? Number(Platform.Version) : undefined,
        cloudTierEnabled: settings.cloudClassificationEnabled,
      });
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScanFlow isDarkMode={isDarkMode} />
    </SafeAreaProvider>
  );
}

export default App;
