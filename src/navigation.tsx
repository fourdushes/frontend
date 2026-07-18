import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from './context/SessionContext';
import { ArchiveDetailScreen } from './screens/ArchiveDetailScreen';
import { ArchiveListScreen } from './screens/ArchiveListScreen';
import { CareScreen } from './screens/CareScreen';
import { ChatScreen } from './screens/ChatScreen';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InstitutionSearchScreen } from './screens/InstitutionSearchScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RecordingScreen } from './screens/RecordingScreen';
import { RequestListScreen } from './screens/RequestListScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SignupScreen } from './screens/SignupScreen';
import { colors } from './theme/theme';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  InstitutionSearch: undefined;
  RequestList: undefined;
  Care: undefined;
  Chat: { chatRoomId: number };
  Recording: { chatRoomId?: number } | undefined;
  ArchiveList: undefined;
  ArchiveDetail: { archiveId: number };
  Settings: undefined;
  Diagnostics: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigation() {
  const { session, ready } = useSession();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text>세션 확인 중</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerBackTitleVisible: false,
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '800' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: '회원가입' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'hearO' }} />
            <Stack.Screen
              name="InstitutionSearch"
              component={InstitutionSearchScreen}
              options={{ title: '의료기관 찾기' }}
            />
            <Stack.Screen
              name="RequestList"
              component={RequestListScreen}
              options={{ title: '진료 요청' }}
            />
            <Stack.Screen name="Care" component={CareScreen} options={{ title: '보호자 연결' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '진료 대화' }} />
            <Stack.Screen
              name="Recording"
              component={RecordingScreen}
              options={{ title: '음성 답변' }}
            />
            <Stack.Screen
              name="ArchiveList"
              component={ArchiveListScreen}
              options={{ title: '진료 기록' }}
            />
            <Stack.Screen
              name="ArchiveDetail"
              component={ArchiveDetailScreen}
              options={{ title: '기록 상세' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: '설정' }}
            />
            <Stack.Screen
              name="Diagnostics"
              component={DiagnosticsScreen}
              options={{ title: '개발자 진단' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
});
