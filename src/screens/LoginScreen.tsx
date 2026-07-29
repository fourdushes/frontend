import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Button, Field, Notice, Screen } from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
type LoginKind = 'USER' | 'INSTITUTION';

export function LoginScreen({ navigation, route }: Props) {
  const { signIn } = useSession();
  const { width } = useWindowDimensions();
  const stacked = width < 860;
  const mobile = width < 640;
  const [kind, setKind] = useState<LoginKind>('USER');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!id.trim() || !password || loading) return;
    if (kind === 'INSTITUTION') {
      setError('현재 백엔드에 기관 전용 로그인 API가 제공되지 않습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await teamApi.login(id.trim(), password);
      await signIn(result);
      const destination = route.params?.redirectTo ?? 'Home';
      navigation.reset({
        index: 0,
        routes: [
          {
            name: destination as never,
            params: route.params?.redirectParams as never,
          },
        ],
      });
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.publicHeader}>
        <Pressable onPress={() => navigation.navigate('MainPreview')}>
          <Text style={styles.headerLink}>서비스 소개로 돌아가기</Text>
        </Pressable>
      </View>

      <View style={[styles.layout, stacked && styles.layoutStacked, mobile && styles.layoutMobile]}>
        <View style={[
          styles.introPanel,
          stacked && styles.introPanelStacked,
        ]}>
          <Text style={styles.introEyebrow}>WELCOME TO HEARO</Text>
          <Text style={[styles.introTitle, stacked && styles.introTitleStacked]}>
            진료의 목소리를{'\n'}다시 이해하는 시간.
          </Text>
          <Text style={styles.introBody}>
            환자, 보호자, 의료기관이 필요한 정보를 각자의 권한 안에서 안전하게 이어봅니다.
          </Text>
          <View style={styles.flowList}>
            {[
              ['01', '요청', '진료를 요청하고 상태를 확인합니다.'],
              ['02', '기록', '대화와 음성을 한 흐름으로 남깁니다.'],
              ['03', '이해', '중요한 내용을 다시 읽고 공유합니다.'],
            ].map(([number, title, copy]) => (
              <View key={number} style={styles.flowItem}>
                <Text style={styles.flowNumber}>{number}</Text>
                <View style={styles.flowCopy}>
                  <Text style={styles.flowTitle}>{title}</Text>
                  <Text style={styles.flowText}>{copy}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.formPanel, stacked && styles.formPanelStacked, mobile && styles.formPanelMobile]}>
          <Text style={styles.formEyebrow}>ACCOUNT ACCESS</Text>
          <Text style={styles.formTitle}>{kind === 'USER' ? '사용자 로그인' : '기관 로그인'}</Text>
          <Text style={styles.formDescription}>
            {kind === 'USER'
              ? '피보호자 사용자, 보호자 사용자, 기관 사용자는 모두 사용자 계정으로 로그인합니다.'
              : '기관 자체 계정으로 로그인합니다.'}
          </Text>

          <View accessibilityRole="tablist" style={styles.kindTabs}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === 'USER' }}
              onPress={() => {
                setKind('USER');
                setError(null);
              }}
              style={[styles.kindTab, kind === 'USER' && styles.kindTabActive]}
            >
              <Text style={[styles.kindTabText, kind === 'USER' && styles.kindTabTextActive]}>
                사용자
              </Text>
              <Text style={styles.kindTabMeta}>피보호자 · 보호자 · 기관 사용자</Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === 'INSTITUTION' }}
              onPress={() => {
                setKind('INSTITUTION');
                setError(null);
              }}
              style={[styles.kindTab, kind === 'INSTITUTION' && styles.kindTabActive]}
            >
              <Text style={[styles.kindTabText, kind === 'INSTITUTION' && styles.kindTabTextActive]}>
                기관
              </Text>
              <Text style={styles.kindTabMeta}>기관 자체 계정</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Field
              label="아이디"
              value={id}
              onChangeText={setId}
              placeholder="가입한 아이디를 입력하세요."
              textContentType="username"
            />
            <Field
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              placeholder="비밀번호를 입력하세요."
              secureTextEntry
              textContentType="password"
            />
            {error ? <Notice tone="error" title="로그인하지 못했습니다.">{error}</Notice> : null}
            <Button
              title={loading ? '계정을 확인하고 있습니다…' : kind === 'USER' ? '사용자 로그인' : '기관 로그인'}
              onPress={submit}
              disabled={loading || !id.trim() || !password}
            />
          </View>

          <View style={styles.utilityRow}>
            <Pressable onPress={() => navigation.navigate('AccountRecovery')}>
              <Text style={styles.utilityLink}>아이디 · 비밀번호 찾기</Text>
            </Pressable>
            <View style={styles.utilityDivider} />
            <Pressable onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.utilityLink}>처음이신가요? <Text style={styles.utilityLinkStrong}>회원가입</Text></Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { maxWidth: 1240, paddingTop: 18 },
  publicHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
  },
  headerLink: { color: colors.muted, fontFamily, fontSize: 11 },
  layout: {
    minHeight: 680,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: 16,
  },
  layoutStacked: { flexDirection: 'column' },
  layoutMobile: { flexDirection: 'column-reverse' },
  introPanel: {
    width: '48%',
    padding: 48,
    backgroundColor: colors.ink,
    justifyContent: 'center',
  },
  introPanelStacked: { width: '100%', padding: 28 },
  introEyebrow: { color: '#d8f3ec', fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  introTitle: {
    color: '#fff',
    fontFamily,
    fontSize: 38,
    lineHeight: 51,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 17,
  },
  introTitleStacked: { fontSize: 29, lineHeight: 40 },
  introBody: { color: '#e4f3ef', fontFamily, fontSize: 13, lineHeight: 22, maxWidth: 430, marginTop: 18 },
  flowList: { gap: 1, marginTop: 46 },
  flowItem: {
    minHeight: 74,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
  },
  flowNumber: { width: 27, color: '#d8f3ec', fontFamily, fontSize: 9, fontWeight: '900' },
  flowCopy: { flex: 1 },
  flowTitle: { color: '#fff', fontFamily, fontSize: 12, fontWeight: '900' },
  flowText: { color: '#d1e8e2', fontFamily, fontSize: 10, marginTop: 4 },
  formPanel: { flex: 1, paddingHorizontal: 50, paddingVertical: 46, justifyContent: 'center' },
  formPanelStacked: { paddingHorizontal: 28 },
  formPanelMobile: { paddingHorizontal: 24, paddingVertical: 32 },
  formEyebrow: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  formTitle: { color: colors.text, fontFamily, fontSize: 29, fontWeight: '900', letterSpacing: -0.8, marginTop: 8 },
  formDescription: { color: colors.muted, fontFamily, fontSize: 12, marginTop: 7 },
  kindTabs: { flexDirection: 'row', gap: 9, marginTop: 27 },
  kindTab: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: 14,
    justifyContent: 'center',
  },
  kindTabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  kindTabText: { color: colors.textSoft, fontFamily, fontSize: 12, fontWeight: '900' },
  kindTabTextActive: { color: colors.primary },
  kindTabMeta: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 4 },
  form: { gap: spacing.md, marginTop: 24 },
  utilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 21 },
  utilityDivider: { width: 1, height: 11, backgroundColor: colors.border },
  utilityLink: { color: colors.muted, fontFamily, fontSize: 10, fontWeight: '700' },
  utilityLinkStrong: { color: colors.primary, fontWeight: '900' },
});
