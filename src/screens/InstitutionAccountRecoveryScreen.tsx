import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import {
  InstitutionPasswordPreparation,
  institutionAccountApi,
} from '../api/institutionAccountApi';
import { Button, Field, Notice, Screen, Tabs } from '../components/Ui';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'InstitutionAccountRecovery'>;
type Mode = 'ID' | 'PASSWORD';
type PasswordStep = 'VERIFY_EMAIL' | 'NEW_PASSWORD' | 'DONE';

export function InstitutionAccountRecoveryScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('ID');
  const [passwordStep, setPasswordStep] = useState<PasswordStep>('VERIFY_EMAIL');
  const [institutionName, setInstitutionName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [preparation, setPreparation] = useState<InstitutionPasswordPreparation | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [foundId, setFoundId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  useEffect(() => {
    if (!codeSent || emailVerified || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [codeSent, emailVerified, secondsLeft]);

  function goToInstitutionLogin() {
    navigation.reset({ index: 0, routes: [{ name: 'Login', params: { kind: 'INSTITUTION' } }] });
  }

  function changeMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
    setFoundId(null);
  }

  function resetVerification() {
    setCode('');
    setCodeSent(false);
    setEmailVerified(false);
    setSecondsLeft(0);
    setPreparation(null);
    setPasswordStep('VERIFY_EMAIL');
    setMessage(null);
  }

  async function findId() {
    if (!institutionName.trim() || !validEmail || loading) return;
    setLoading(true);
    setError(null);
    setFoundId(null);
    try {
      setFoundId(await institutionAccountApi.findLoginId(institutionName.trim(), normalizedEmail));
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function sendCode() {
    if (!validEmail || loading) return;
    setLoading(true);
    setError(null);
    try {
      await institutionAccountApi.sendVerificationCode(normalizedEmail);
      setCodeSent(true);
      setSecondsLeft(180);
      setMessage('인증번호를 보냈습니다. 메일함과 스팸함을 확인해 주세요.');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndContinue() {
    if (!institutionName.trim() || code.length !== 6 || secondsLeft <= 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await institutionAccountApi.verifyVerificationCode(normalizedEmail, code);
      setEmailVerified(true);
      setSecondsLeft(0);
      setPreparation(await institutionAccountApi.preparePasswordChange(institutionName.trim(), normalizedEmail));
      setPasswordStep('NEW_PASSWORD');
      setMessage(null);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function changePassword() {
    if (!preparation || !newPassword || newPassword !== passwordConfirm || loading) return;
    setLoading(true);
    setError(null);
    try {
      await institutionAccountApi.changePassword({
        institutionId: preparation.institutionId,
        newPassword,
        checkNewPassword: passwordConfirm,
        tempToken: preparation.tempToken,
      });
      setNewPassword('');
      setPasswordConfirm('');
      setPreparation(null);
      setPasswordStep('DONE');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={goToInstitutionLogin}>
          <Text style={styles.backToLogin}>← 기관 로그인으로 돌아가기</Text>
        </Pressable>
        <View style={styles.institutionBadge}><Text style={styles.institutionBadgeText}>기관 계정</Text></View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardIntro}>
          <Text style={styles.eyebrow}>INSTITUTION ACCOUNT RECOVERY</Text>
          <Text style={styles.title}>기관 계정을 다시 찾을 수 있도록 도와드릴게요.</Text>
          <Text style={styles.description}>등록한 기관명과 기관 이메일을 기준으로 안전하게 확인합니다.</Text>
        </View>

        <View style={styles.formArea}>
          <Tabs
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'ID', label: '기관 아이디 찾기' },
              { value: 'PASSWORD', label: '기관 비밀번호 재설정' },
            ]}
          />

          {mode === 'ID' ? (
            <View style={styles.form}>
              <View>
                <Text style={styles.stepLabel}>FIND INSTITUTION ID</Text>
                <Text style={styles.formTitle}>기관명과 이메일을 입력해 주세요.</Text>
              </View>
              <Field label="기관명" value={institutionName} onChangeText={setInstitutionName} onSubmitEditing={findId} placeholder="등록한 기관명" />
              <Field
                label="기관 이메일"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={findId}
                keyboardType="email-address"
                placeholder="institution@example.com"
                error={email.length > 3 && !validEmail ? '올바른 이메일 형식을 입력해 주세요.' : undefined}
              />
              {error ? <Notice tone="error" title="기관 계정을 찾지 못했습니다.">{error}</Notice> : null}
              {foundId ? (
                <View style={styles.resultCard}>
                  <Text style={styles.resultLabel}>등록된 기관 로그인 아이디</Text>
                  <Text selectable style={styles.resultValue}>{foundId}</Text>
                  <Text style={styles.resultHint}>보안을 위해 공용 기기에서는 확인 후 화면을 닫아 주세요.</Text>
                </View>
              ) : null}
              <Button title={loading ? '기관 계정을 확인하고 있습니다…' : '기관 아이디 찾기'} onPress={findId} disabled={loading || !institutionName.trim() || !validEmail} />
              {foundId ? <Button title="기관 로그인으로 이동" tone="secondary" onPress={goToInstitutionLogin} /> : null}
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.progress}>
                {['이메일 인증', '새 비밀번호', '완료'].map((label, index) => {
                  const current = passwordStep === 'VERIFY_EMAIL' ? 0 : passwordStep === 'NEW_PASSWORD' ? 1 : 2;
                  return (
                    <View key={label} style={styles.progressItem}>
                      <View style={[styles.progressDot, index <= current && styles.progressDotActive]}>
                        <Text style={[styles.progressNumber, index <= current && styles.progressNumberActive]}>{index + 1}</Text>
                      </View>
                      <Text style={[styles.progressLabel, index === current && styles.progressLabelActive]}>{label}</Text>
                    </View>
                  );
                })}
              </View>

              {passwordStep === 'VERIFY_EMAIL' ? (
                <>
                  <View>
                    <Text style={styles.stepLabel}>STEP 1</Text>
                    <Text style={styles.formTitle}>기관 이메일 인증을 진행해 주세요.</Text>
                  </View>
                  <Field label="기관명" value={institutionName} onChangeText={setInstitutionName} placeholder="등록한 기관명" />
                  <Field
                    label="기관 이메일"
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      resetVerification();
                    }}
                    editable={!emailVerified}
                    keyboardType="email-address"
                    placeholder="institution@example.com"
                    error={email.length > 3 && !validEmail ? '올바른 이메일 형식을 입력해 주세요.' : undefined}
                  />
                  <Button title={codeSent ? '인증번호 다시 받기' : '인증번호 받기'} tone={codeSent ? 'secondary' : 'primary'} onPress={sendCode} disabled={loading || !validEmail || emailVerified} />
                  {codeSent ? (
                    <Field
                      label="인증번호"
                      value={code}
                      onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                      onSubmitEditing={verifyAndContinue}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="6자리 숫자"
                      hint={secondsLeft > 0 ? formatTime(secondsLeft) : '인증번호 만료'}
                    />
                  ) : null}
                  {message ? <Notice>{message}</Notice> : null}
                  {error ? <Notice tone="error">{error}</Notice> : null}
                  <Button title={loading ? '인증하고 있습니다…' : '인증 후 계속'} onPress={verifyAndContinue} disabled={loading || !institutionName.trim() || code.length !== 6 || secondsLeft <= 0} />
                </>
              ) : null}

              {passwordStep === 'NEW_PASSWORD' && preparation ? (
                <>
                  <View>
                    <Text style={styles.stepLabel}>STEP 2</Text>
                    <Text style={styles.formTitle}>기관 계정의 새 비밀번호를 설정해 주세요.</Text>
                  </View>
                  <Notice tone="success" title="기관 확인 완료">확인된 기관 계정의 비밀번호를 변경합니다.</Notice>
                  <Field label="새 비밀번호" value={newPassword} onChangeText={setNewPassword} placeholder="새 비밀번호" secureTextEntry={!passwordVisible} />
                  <Field
                    label="새 비밀번호 확인"
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    onSubmitEditing={changePassword}
                    placeholder="새 비밀번호 다시 입력"
                    secureTextEntry={!passwordVisible}
                    error={passwordConfirm && newPassword !== passwordConfirm ? '비밀번호가 일치하지 않습니다.' : undefined}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'} onPress={() => setPasswordVisible((value) => !value)} style={styles.visibilityButton}>
                    <Text style={styles.visibilityButtonText}>{passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}</Text>
                  </Pressable>
                  {error ? <Notice tone="error">{error}</Notice> : null}
                  <Button title={loading ? '변경하고 있습니다…' : '기관 비밀번호 변경'} onPress={changePassword} disabled={loading || !newPassword || newPassword !== passwordConfirm} />
                </>
              ) : null}

              {passwordStep === 'DONE' ? (
                <View style={styles.done}>
                  <View style={styles.doneIcon}><Text style={styles.doneIconText}>✓</Text></View>
                  <Text style={styles.doneTitle}>기관 비밀번호가 변경되었습니다.</Text>
                  <Text style={styles.doneText}>새 비밀번호로 기관 계정에 로그인해 주세요.</Text>
                  <View style={styles.doneButton}><Button title="기관 로그인으로 이동" onPress={goToInstitutionLogin} /></View>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

function formatTime(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { maxWidth: 920, paddingTop: 18 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backToLogin: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  institutionBadge: { minHeight: 28, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  institutionBadgeText: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900' },
  card: { marginTop: 15, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface },
  cardIntro: { minHeight: 210, padding: 38, justifyContent: 'center', backgroundColor: colors.ink },
  eyebrow: { color: '#d8f3ec', fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { maxWidth: 620, marginTop: 10, color: '#fff', fontFamily, fontSize: 27, lineHeight: 37, fontWeight: '900', letterSpacing: -0.7 },
  description: { marginTop: 8, color: '#e0f0ec', fontFamily, fontSize: 11, lineHeight: 19 },
  formArea: { padding: 36 },
  form: { gap: spacing.md, marginTop: 28 },
  stepLabel: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  formTitle: { marginTop: 6, color: colors.text, fontFamily, fontSize: 18, fontWeight: '900' },
  resultCard: { padding: 20, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  resultLabel: { color: colors.muted, fontFamily, fontSize: 9, fontWeight: '800' },
  resultValue: { marginTop: 7, color: colors.primary, fontFamily, fontSize: 21, fontWeight: '900' },
  resultHint: { marginTop: 8, color: colors.muted, fontFamily, fontSize: 9 },
  progress: { marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  progressItem: { flex: 1, alignItems: 'center', gap: 6 },
  progressDot: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 15 },
  progressDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  progressNumber: { color: colors.faint, fontFamily, fontSize: 9, fontWeight: '900' },
  progressNumberActive: { color: '#fff' },
  progressLabel: { color: colors.faint, fontFamily, fontSize: 9, fontWeight: '700' },
  progressLabelActive: { color: colors.text, fontWeight: '900' },
  visibilityButton: { alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 4 },
  visibilityButtonText: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  done: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
  doneIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 30, backgroundColor: colors.successSoft },
  doneIconText: { color: colors.success, fontFamily, fontSize: 24, fontWeight: '900' },
  doneTitle: { marginTop: 20, color: colors.text, fontFamily, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  doneText: { marginTop: 7, color: colors.muted, fontFamily, fontSize: 11, textAlign: 'center' },
  doneButton: { minWidth: 220, marginTop: 24 },
});
