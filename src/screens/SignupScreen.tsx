import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { teamApi } from '../api/teamApi';
import { Button, Field, Notice, Screen, Section, uiStyles } from '../components/Ui';
import { useAction } from '../components/useAction';
import { RootStackParamList } from '../navigation';
import { UserType } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const roles: Array<{ value: UserType; label: string; description: string }> = [
  { value: 'WARD', label: '환자', description: '채팅으로 진료하고 기록을 확인합니다.' },
  { value: 'GUARDIAN', label: '보호자', description: '환자에게 보호자 연결을 신청합니다.' },
  { value: 'INSTITUTIONS', label: '의료기관', description: '진료 요청을 받고 음성으로 답변합니다.' },
];

export function SignupScreen({ navigation }: Props) {
  const action = useAction();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [userType, setUserType] = useState<UserType>('WARD');
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [created, setCreated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  useEffect(() => {
    if (!emailSent || emailVerified || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailSent, emailVerified, secondsLeft]);

  function changeEmail(value: string) {
    setEmail(value);
    setEmailSent(false);
    setEmailVerified(false);
    setCheckNumber('');
    setSecondsLeft(0);
    setMessage(null);
  }

  async function sendCode() {
    const result = await action.run(() => teamApi.sendEmailCode(normalizedEmail));
    if (result !== undefined) {
      setEmailSent(true);
      setEmailVerified(false);
      setSecondsLeft(180);
      setMessage('인증번호를 발송했습니다. 메일함과 스팸함을 확인하세요.');
    }
  }

  async function verifyCode() {
    const result = await action.run(() =>
      teamApi.checkEmailCode(normalizedEmail, checkNumber.trim()),
    );
    if (result !== undefined) {
      setEmailVerified(true);
      setSecondsLeft(0);
      setMessage('이메일 인증이 완료되었습니다.');
    }
  }

  async function signup() {
    if (!emailVerified) return;
    const result = await action.run(() =>
      teamApi.join({
        id: id.trim(),
        name: name.trim(),
        email: normalizedEmail,
        password,
        userType,
      }),
    );
    if (result !== undefined) setCreated(true);
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>회원가입</Text>
      <Text style={uiStyles.subtitle}>
        계정 정보를 입력하고 이메일 인증을 완료하세요.
      </Text>

      <Section title="1. 역할 선택">
        <View style={uiStyles.row}>
          {roles.map((role) => (
            <View key={role.value} style={uiStyles.flex}>
              <Button
                title={`${userType === role.value ? '✓ ' : ''}${role.label}`}
                tone={userType === role.value ? 'primary' : 'secondary'}
                onPress={() => setUserType(role.value)}
              />
            </View>
          ))}
        </View>
        <Text style={uiStyles.subtitle}>
          {roles.find((role) => role.value === userType)?.description}
        </Text>
      </Section>

      <Section title="2. 이메일 인증" description="인증번호는 발송 후 3분 동안 유효합니다.">
        <Field
          label="이메일"
          value={email}
          onChangeText={changeEmail}
          keyboardType="email-address"
          placeholder="name@example.com"
          editable={!emailVerified}
        />
        <Button
          title={emailSent ? '인증번호 다시 받기' : '인증번호 받기'}
          tone={emailSent ? 'secondary' : 'primary'}
          onPress={sendCode}
          disabled={action.loading || !validEmail || emailVerified}
        />
        {emailSent && !emailVerified ? (
          <>
            <Field
              label={`인증번호${secondsLeft > 0 ? ` · ${formatTime(secondsLeft)}` : ' · 만료됨'}`}
              value={checkNumber}
              onChangeText={(value) => setCheckNumber(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="6자리 숫자"
              maxLength={6}
            />
            <Button
              title="인증번호 확인"
              onPress={verifyCode}
              disabled={action.loading || checkNumber.length !== 6 || secondsLeft <= 0}
            />
          </>
        ) : null}
        {message ? <Notice>{message}</Notice> : null}
        {emailVerified ? <Text style={uiStyles.badge}>✓ 이메일 인증 완료</Text> : null}
      </Section>

      <Section title="3. 계정 정보">
        <Field label="아이디" value={id} onChangeText={setId} placeholder="영문·숫자 조합" />
        <Field label="이름" value={name} onChangeText={setName} placeholder="이름 또는 기관명" />
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="비밀번호 입력"
        />
        {action.error ? <Notice tone="error">{action.error}</Notice> : null}
        {created ? (
          <>
            <Notice>가입이 완료되었습니다. 새 계정으로 로그인하세요.</Notice>
            <Button title="로그인으로 이동" onPress={() => navigation.navigate('Login')} />
          </>
        ) : (
          <Button
            title={action.loading ? '처리 중...' : '가입 완료'}
            onPress={signup}
            disabled={
              action.loading ||
              !emailVerified ||
              !id.trim() ||
              !name.trim() ||
              !password
            }
          />
        )}
      </Section>
    </Screen>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
