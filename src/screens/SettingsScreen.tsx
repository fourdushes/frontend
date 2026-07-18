import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text } from 'react-native';

import { teamApi } from '../api/teamApi';
import { Button, Notice, Screen, Section, uiStyles } from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { session, signOut } = useSession();
  const [health, setHealth] = useState<'idle' | 'checking' | 'up' | 'down'>('idle');

  async function checkServer() {
    setHealth('checking');
    try {
      await teamApi.health();
      setHealth('up');
    } catch {
      setHealth('down');
    }
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>설정</Text>
      <Section title="내 계정">
        <Text style={uiStyles.subtitle}>아이디 · {session?.userId}</Text>
        <Text style={uiStyles.subtitle}>역할 · {session?.userType}</Text>
      </Section>
      <Section title="연결 상태">
        {health === 'up' ? <Notice>서버, 데이터베이스, Redis가 정상 연결되었습니다.</Notice> : null}
        {health === 'down' ? <Notice tone="error">서버 연결에 실패했습니다.</Notice> : null}
        <Button
          title={health === 'checking' ? '확인 중...' : '서버 상태 확인'}
          tone="secondary"
          onPress={checkServer}
          disabled={health === 'checking'}
        />
      </Section>
      <Section title="개발자 도구">
        <Button
          title="API 진단 로그"
          tone="secondary"
          onPress={() => navigation.navigate('Diagnostics')}
        />
      </Section>
      <Button title="로그아웃" tone="danger" onPress={signOut} />
    </Screen>
  );
}
