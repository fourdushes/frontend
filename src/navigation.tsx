import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ComponentType, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from './context/SessionContext';
import { useTreatmentRequest } from './context/TreatmentRequestContext';
import { AccountRecoveryScreen } from './screens/AccountRecoveryScreen';
import { ArchiveDetailScreen } from './screens/ArchiveDetailScreen';
import { ArchiveListScreen } from './screens/ArchiveListScreen';
import { CareScreen } from './screens/CareScreen';
import { ChatScreen } from './screens/ChatScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InquiryDetailScreen } from './screens/InquiryDetailScreen';
import { InquiryScreen } from './screens/InquiryScreen';
import { InstitutionSearchScreen } from './screens/InstitutionSearchScreen';
import { InstitutionAdminScreen } from './screens/InstitutionAdminScreen';
import { InstitutionAccountRecoveryScreen } from './screens/InstitutionAccountRecoveryScreen';
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
    kind?: 'USER' | 'INSTITUTION';
    redirectTo?: keyof RootStackParamList;
    redirectParams?: Record<string, unknown>;
  } | undefined;
  Signup: { group?: SignupGroup } | undefined;
  AccountRecovery: undefined;
  InstitutionAccountRecovery: undefined;
  Home: undefined;
  InstitutionAdmin: undefined;
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
    const { activeRequest, inProgressRequest, waitingRequest, ready: treatmentRequestReady } = useTreatmentRequest();
    const isWard = session?.userType === 'WARD';
    const isInstitution = session?.userType === 'INSTITUTIONS';
    const isMedicalUser = isWard || isInstitution;
    const activeChatRoomId = inProgressRequest?.chatRoomId;
    const routeChatRoomId = props.route.name === 'Chat' ? Number(props.route.params?.chatRoomId) : null;
    const isLegacyWardRequestRoute = isWard && props.route.name === 'RequestList';
    const isWaitingRouteLocked = isWard && Boolean(waitingRequest) && props.route.name !== 'InstitutionSearch';
    const isAcceptedRouteLocked = isWard
      && Boolean(activeRequest && (activeRequest.status === 'ACCEPTED' || (activeRequest.status === 'IN_PROGRESS' && !activeChatRoomId)))
      && !['InstitutionSearch', 'Chat'].includes(props.route.name);
    const isTreatmentRouteLocked = isMedicalUser
      && Boolean(activeChatRoomId)
      && (props.route.name !== 'Chat' || routeChatRoomId !== activeChatRoomId);

    useEffect(() => {
      if (!session) {
        props.navigation.replace('Login', {
          redirectTo: props.route.name,
          redirectParams: props.route.params,
        });
      } else if (treatmentRequestReady && isTreatmentRouteLocked && activeChatRoomId) {
        props.navigation.replace('Chat', {
          chatRoomId: activeChatRoomId,
          requestId: inProgressRequest?.medicalRequestId,
        });
      } else if (treatmentRequestReady && (isLegacyWardRequestRoute || isWaitingRouteLocked || isAcceptedRouteLocked)) {
        props.navigation.replace('InstitutionSearch');
      }
    }, [activeChatRoomId, inProgressRequest?.medicalRequestId, isAcceptedRouteLocked, isLegacyWardRequestRoute, isTreatmentRouteLocked, isWaitingRouteLocked, props.navigation, props.route.name, props.route.params, session, treatmentRequestReady]);

    if (!session) return <RouteLoading label="로그인 화면으로 이동하고 있습니다." />;
    if (isMedicalUser && !treatmentRequestReady) return <RouteLoading label="진료 요청 상태를 확인하고 있습니다." />;
    if (isTreatmentRouteLocked) return <RouteLoading label="진료 중인 대화방으로 이동하고 있습니다." />;
    if (isLegacyWardRequestRoute || isWaitingRouteLocked || isAcceptedRouteLocked) return <RouteLoading label="진료 요청 화면으로 이동하고 있습니다." />;
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
const GuestInstitutionRecovery = guestScreen(InstitutionAccountRecoveryScreen);
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
      InstitutionAccountRecovery: 'institution-account-recovery',
      Home: 'home',
      InstitutionAdmin: 'institution-admin',
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
        <Stack.Screen name="InstitutionAccountRecovery" component={GuestInstitutionRecovery} />
        <Stack.Screen name="Home" component={ProtectedHome} />
        <Stack.Screen name="InstitutionAdmin" component={InstitutionAdminScreen} />
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
