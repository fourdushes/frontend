import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from './src/context/SessionContext';
import { TreatmentRequestProvider } from './src/context/TreatmentRequestContext';
import { RootNavigation } from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <TreatmentRequestProvider>
          <StatusBar style="dark" />
          <RootNavigation />
        </TreatmentRequestProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
