import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {ScanFlow} from './src/screens/ScanFlow';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScanFlow isDarkMode={isDarkMode} />
    </SafeAreaProvider>
  );
}

export default App;
