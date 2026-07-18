import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from './src/context/SessionContext';
import { RootNavigation } from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigation />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
