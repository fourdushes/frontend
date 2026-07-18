import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { teamApi } from '../api/teamApi';
import { Button, Field, Notice, Screen, Section, uiStyles } from '../components/Ui';
import { useAction } from '../components/useAction';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, spacing } from '../theme/theme';
import { LoginResponse } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useSession();
  const action = useAction();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  async function login() {
    const result = await action.run(() => teamApi.login(id.trim(), password));
    if (result) await signIn(result as LoginResponse);
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.brand}>hearO</Text>
        <Text style={uiStyles.pageTitle}>대화를 놓치지 않는 진료</Text>
        <Text style={uiStyles.subtitle}>
          환자·보호자·의료기관을 연결하고 진료 대화를 기록합니다.
        </Text>
      </View>
      <Section title="로그인">
        <Field label="아이디" value={id} onChangeText={setId} placeholder="아이디 입력" />
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="비밀번호 입력"
          onSubmitEditing={login}
        />
        {action.error ? <Notice tone="error">{action.error}</Notice> : null}
        <Button
          title={action.loading ? '로그인 중...' : '로그인'}
          onPress={login}
          disabled={!id.trim() || !password || action.loading}
        />
      </Section>
      <Section title="처음이신가요?">
        <Button
          title="회원가입"
          tone="secondary"
          onPress={() => navigation.navigate('Signup')}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingTop: 56,
    paddingBottom: spacing.lg,
  },
  brand: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
  },
});
