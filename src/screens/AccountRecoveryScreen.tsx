import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Button, Field, Notice, Screen, Tabs } from '../components/Ui';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { PasswordChangePreparation } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountRecovery'>;
type Mode = 'ID' | 'PASSWORD';
type PasswordStep = 'VERIFY_EMAIL' | 'NEW_PASSWORD' | 'DONE';

export function AccountRecoveryScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('ID');
  const [passwordStep, setPasswordStep] = useState<PasswordStep>('VERIFY_EMAIL');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [preparation, setPreparation] = useState<PasswordChangePreparation | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
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
    if (!name.trim() || !validEmail || loading) return;
    setLoading(true);
    setError(null);
    setFoundId(null);
    try {
      setFoundId(await teamApi.findId(name.trim(), normalizedEmail));
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
      await teamApi.sendEmailCode(normalizedEmail);
      setCodeSent(true);
      setSecondsLeft(180);
      setMessage('인증번호를 보냈습니다.');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndContinue() {
    if (!name.trim() || code.length !== 6 || secondsLeft <= 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await teamApi.checkEmailCode(normalizedEmail, code);
      setEmailVerified(true);
      setSecondsLeft(0);
      const result = await teamApi.preparePasswordChange(name.trim(), normalizedEmail);
      setPreparation(result);
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
      await teamApi.changePassword({
        id: preparation.id,
        newPassword,
        checkNewPassword: passwordConfirm,
        userType: preparation.userType,
        tempToken: preparation.tempToken,
      });
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
        <Pressable onPress={() => navigation.navigate('MainPreview')}>
          <Image source={require('../../assets/hearo-wordmark.png')} resizeMode="contain" style={styles.logo} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backToLogin}>로그인으로 돌아가기  →</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardIntro}>
          <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
          <Text style={styles.title}>계정을 다시 찾을 수 있도록 도와드릴게요.</Text>
          <Text style={styles.description}>
            가입할 때 사용한 이름과 이메일을 기준으로 안전하게 확인합니다.
          </Text>
        </View>

        <View style={styles.formArea}>
          <Tabs
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'ID', label: '아이디 찾기' },
              { value: 'PASSWORD', label: '비밀번호 재설정' },
            ]}
          />

          {mode === 'ID' ? (
            <View style={styles.form}>
              <View>
                <Text style={styles.stepLabel}>FIND YOUR ID</Text>
                <Text style={styles.formTitle}>이름과 이메일을 입력해 주세요.</Text>
              </View>
              <Field label="이름" value={name} onChangeText={setName} placeholder="가입 시 입력한 이름" />
              <Field
                label="이메일"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                placeholder="name@example.com"
                error={email.length > 3 && !validEmail ? '올바른 이메일 형식을 입력해 주세요.' : undefined}
              />
              {error ? <Notice tone="error">{error}</Notice> : null}
              {foundId ? (
                <View style={styles.resultCard}>
                  <Text style={styles.resultLabel}>가입된 아이디</Text>
                  <Text selectable style={styles.resultValue}>{foundId}</Text>
                  <Text style={styles.resultHint}>보안을 위해 공용 기기에서는 화면을 닫아 주세요.</Text>
                </View>
              ) : null}
              <Button
                title={loading ? '계정을 확인하고 있습니다…' : '아이디 찾기'}
                onPress={findId}
                disabled={loading || !name.trim() || !validEmail}
              />
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
                    <Text style={styles.formTitle}>이메일 인증을 진행해 주세요.</Text>
                  </View>
                  <Field label="이름" value={name} onChangeText={setName} placeholder="가입 시 입력한 이름" />
                  <Field
                    label="이메일"
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      resetVerification();
                    }}
                    editable={!emailVerified}
                    keyboardType="email-address"
                    placeholder="name@example.com"
                  />
                  <Button
                    title={codeSent ? '인증번호 다시 받기' : '인증번호 받기'}
                    tone={codeSent ? 'secondary' : 'primary'}
                    onPress={sendCode}
                    disabled={loading || !validEmail || emailVerified}
                  />
                  {codeSent ? (
                    <Field
                      label="인증번호"
                      value={code}
                      onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="6자리 숫자"
                      hint={secondsLeft > 0 ? formatTime(secondsLeft) : '인증번호 만료'}
                    />
                  ) : null}
                  {message ? <Notice>{message}</Notice> : null}
                  {error ? <Notice tone="error">{error}</Notice> : null}
                  <Button
                    title={loading ? '인증하고 있습니다…' : '인증 후 계속'}
                    onPress={verifyAndContinue}
                    disabled={loading || !name.trim() || code.length !== 6 || secondsLeft <= 0}
                  />
                </>
              ) : null}

              {passwordStep === 'NEW_PASSWORD' && preparation ? (
                <>
                  <View>
                    <Text style={styles.stepLabel}>STEP 2</Text>
                    <Text style={styles.formTitle}>새 비밀번호를 설정해 주세요.</Text>
                  </View>
                  <Notice tone="success" title="본인 확인 완료">
                    {preparation.id} 계정의 비밀번호를 변경합니다.
                  </Notice>
                  <Field
                    label="새 비밀번호"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="새 비밀번호"
                    secureTextEntry
                  />
                  <Field
                    label="새 비밀번호 확인"
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    placeholder="새 비밀번호 다시 입력"
                    secureTextEntry
                    error={passwordConfirm && newPassword !== passwordConfirm ? '비밀번호가 일치하지 않습니다.' : undefined}
                  />
                  {error ? <Notice tone="error">{error}</Notice> : null}
                  <Button
                    title={loading ? '변경하고 있습니다…' : '비밀번호 변경'}
                    onPress={changePassword}
                    disabled={loading || !newPassword || newPassword !== passwordConfirm}
                  />
                </>
              ) : null}

              {passwordStep === 'DONE' ? (
                <View style={styles.done}>
                  <View style={styles.doneIcon}><Text style={styles.doneIconText}>✓</Text></View>
                  <Text style={styles.doneTitle}>비밀번호가 변경되었습니다.</Text>
                  <Text style={styles.doneText}>새 비밀번호로 안전하게 로그인해 주세요.</Text>
                  <View style={styles.doneButton}>
                    <Button title="로그인으로 이동" onPress={() => navigation.navigate('Login')} />
                  </View>
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
  logo: { width: 116, height: 42 },
  backToLogin: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginTop: 15,
  },
  cardIntro: { minHeight: 210, backgroundColor: colors.ink, padding: 38, justifyContent: 'center' },
  eyebrow: { color: '#d8f3ec', fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#fff', fontFamily, fontSize: 27, lineHeight: 37, fontWeight: '900', letterSpacing: -0.7, marginTop: 10 },
  description: { color: '#e0f0ec', fontFamily, fontSize: 11, lineHeight: 19, marginTop: 8 },
  formArea: { padding: 36 },
  form: { gap: spacing.md, marginTop: 28 },
  stepLabel: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  formTitle: { color: colors.text, fontFamily, fontSize: 18, fontWeight: '900', marginTop: 6 },
  resultCard: { borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: 20 },
  resultLabel: { color: colors.muted, fontFamily, fontSize: 9, fontWeight: '800' },
  resultValue: { color: colors.primary, fontFamily, fontSize: 21, fontWeight: '900', marginTop: 7 },
  resultHint: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 8 },
  progress: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  progressItem: { flex: 1, alignItems: 'center', gap: 6 },
  progressDot: { width: 29, height: 29, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  progressNumber: { color: colors.faint, fontFamily, fontSize: 9, fontWeight: '900' },
  progressNumberActive: { color: '#fff' },
  progressLabel: { color: colors.faint, fontFamily, fontSize: 9, fontWeight: '700' },
  progressLabelActive: { color: colors.text, fontWeight: '900' },
  done: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
  doneIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  doneIconText: { color: colors.success, fontFamily, fontSize: 24, fontWeight: '900' },
  doneTitle: { color: colors.text, fontFamily, fontSize: 21, fontWeight: '900', marginTop: 20 },
  doneText: { color: colors.muted, fontFamily, fontSize: 11, marginTop: 7 },
  doneButton: { minWidth: 220, marginTop: 24 },
});
