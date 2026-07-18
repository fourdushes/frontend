import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
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
  const [userType, setUserType] = useState<UserType>('WARD');
  const [created, setCreated] = useState(false);

  async function signup() {
    const result = await action.run(() =>
      teamApi.join({
        id: id.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        userType,
      }),
    );
    if (result !== undefined) setCreated(true);
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>회원가입</Text>
      <Text style={uiStyles.subtitle}>서비스에서 사용할 역할과 기본 정보를 입력하세요.</Text>
      <Section title="역할 선택">
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
      <Section title="계정 정보">
        <Field label="아이디" value={id} onChangeText={setId} placeholder="영문·숫자 조합" />
        <Field label="이름" value={name} onChangeText={setName} placeholder="이름 또는 기관명" />
        <Field
          label="이메일"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="name@example.com"
        />
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
            title={action.loading ? '가입 중...' : '가입 완료'}
            onPress={signup}
            disabled={
              action.loading ||
              !id.trim() ||
              !name.trim() ||
              !email.trim() ||
              !password
            }
          />
        )}
      </Section>
    </Screen>
  );
}
