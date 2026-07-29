import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ComponentType, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from './context/SessionContext';
import { AccountRecoveryScreen } from './screens/AccountRecoveryScreen';
import { ArchiveDetailScreen } from './screens/ArchiveDetailScreen';
import { ArchiveListScreen } from './screens/ArchiveListScreen';
import { CareScreen } from './screens/CareScreen';
import { ChatScreen } from './screens/ChatScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InquiryDetailScreen } from './screens/InquiryDetailScreen';
import { InquiryScreen } from './screens/InquiryScreen';
import { InstitutionSearchScreen } from './screens/InstitutionSearchScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MainPreviewScreen } from './screens/MainPreviewScreen';
import { RequestListScreen } from './screens/RequestListScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SignupScreen } from './screens/SignupScreen';
import { colors, fontFamily } from './theme/theme';

export type SignupGroup = 'USER' | 'INSTITUTION';

export type RootStackParamList = {
  MainPreview: undefined;
  Login: {
    redirectTo?: keyof RootStackParamList;
    redirectParams?: Record<string, unknown>;
  } | undefined;
  Signup: { group?: SignupGroup } | undefined;
  AccountRecovery: undefined;
  Home: undefined;
  InstitutionSearch: undefined;
  RequestList: undefined;
  Care: undefined;
  Chat: { chatRoomId: number; requestId?: number };
  ArchiveList: undefined;
  ArchiveDetail: { archiveId: number };
  Settings: undefined;
  Inquiry: { mode?: 'create' } | undefined;
  InquiryDetail: { inquiryId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function protectedScreen(Component: ComponentType<any>) {
  return function ProtectedScreen(props: any) {
    const { session } = useSession();

    useEffect(() => {
      if (!session) {
        props.navigation.replace('Login', {
          redirectTo: props.route.name,
          redirectParams: props.route.params,
        });
      }
    }, [props.navigation, props.route.name, props.route.params, session]);

    if (!session) return <RouteLoading label="로그인 화면으로 이동하고 있습니다." />;
    return <Component {...props} />;
  };
}

function guestScreen(Component: ComponentType<any>) {
  return function GuestScreen(props: any) {
    const { session } = useSession();

    useEffect(() => {
      if (session) props.navigation.replace('Home');
    }, [props.navigation, session]);

    if (session) return <RouteLoading label="로그인 홈으로 이동하고 있습니다." />;
    return <Component {...props} />;
  };
}

const GuestLogin = guestScreen(LoginScreen);
const GuestSignup = guestScreen(SignupScreen);
const GuestRecovery = guestScreen(AccountRecoveryScreen);
const GuestMainPreview = guestScreen(MainPreviewScreen);
const ProtectedHome = protectedScreen(HomeScreen);
const ProtectedInstitutionSearch = protectedScreen(InstitutionSearchScreen);
const ProtectedRequestList = protectedScreen(RequestListScreen);
const ProtectedCare = protectedScreen(CareScreen);
const ProtectedChat = protectedScreen(ChatScreen);
const ProtectedArchiveList = protectedScreen(ArchiveListScreen);
const ProtectedArchiveDetail = protectedScreen(ArchiveDetailScreen);
const ProtectedSettings = protectedScreen(SettingsScreen);
const ProtectedInquiry = protectedScreen(InquiryScreen);
const ProtectedInquiryDetail = protectedScreen(InquiryDetailScreen);

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      MainPreview: '',
      Login: 'login',
      Signup: 'signup',
      AccountRecovery: 'account-recovery',
      Home: 'home',
      InstitutionSearch: 'institutions',
      RequestList: 'requests',
      Care: 'care',
      Chat: 'chat/:chatRoomId',
      ArchiveList: 'archives',
      ArchiveDetail: 'archives/:archiveId',
      Settings: 'mypage',
      Inquiry: 'inquiries',
      InquiryDetail: 'inquiries/:inquiryId',
    },
  },
};

export function RootNavigation() {
  const { session, ready } = useSession();

  if (!ready) return <RouteLoading label="안전한 세션을 확인하고 있습니다." />;

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName={session ? 'Home' : 'MainPreview'}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="MainPreview" component={GuestMainPreview} />
        <Stack.Screen name="Login" component={GuestLogin} />
        <Stack.Screen name="Signup" component={GuestSignup} />
        <Stack.Screen name="AccountRecovery" component={GuestRecovery} />
        <Stack.Screen name="Home" component={ProtectedHome} />
        <Stack.Screen name="InstitutionSearch" component={ProtectedInstitutionSearch} />
        <Stack.Screen name="RequestList" component={ProtectedRequestList} />
        <Stack.Screen name="Care" component={ProtectedCare} />
        <Stack.Screen name="Chat" component={ProtectedChat} />
        <Stack.Screen name="ArchiveList" component={ProtectedArchiveList} />
        <Stack.Screen name="ArchiveDetail" component={ProtectedArchiveDetail} />
        <Stack.Screen name="Settings" component={ProtectedSettings} />
        <Stack.Screen name="Inquiry" component={ProtectedInquiry} />
        <Stack.Screen name="InquiryDetail" component={ProtectedInquiryDetail} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function RouteLoading({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <View style={styles.loadingMark}><Text style={styles.loadingMarkText}>O</Text></View>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.canvas,
  },
  loadingMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  loadingMarkText: { color: '#fff', fontFamily, fontSize: 18, fontWeight: '900' },
  loadingText: { color: colors.muted, fontFamily, fontSize: 11 },
});
