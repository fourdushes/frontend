import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Button, EmptyState, Field, Notice, Screen, Section, uiStyles } from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, spacing } from '../theme/theme';
import { MedicalRequest } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestList'>;

const statusLabel: Record<string, string> = {
  REQUESTED: '응답 대기',
  ACCEPTED: '수락됨',
  REJECTED: '거절됨',
  IN_PROGRESS: '진료 중',
  COMPLETED: '진료 완료',
};

export function RequestListScreen({ navigation }: Props) {
  const { session } = useSession();
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [chatRoomId, setChatRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWard = session?.userType === 'WARD';
  const isInstitution = session?.userType === 'INSTITUTIONS';

  const load = useCallback(async () => {
    if (!isWard && !isInstitution) return;
    setLoading(true);
    setError(null);
    try {
      setRequests(
        (isInstitution
          ? await teamApi.getInstitutionRequests()
          : await teamApi.getWardRequests()) ?? [],
      );
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [isInstitution, isWard]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(id: number, accept: boolean) {
    setLoading(true);
    setError(null);
    try {
      if (accept) await teamApi.acceptRequest(id);
      else await teamApi.rejectRequest(id);
      await load();
    } catch (caught) {
      setError(readableError(caught));
      setLoading(false);
    }
  }

  async function start(id: number) {
    setLoading(true);
    setError(null);
    try {
      const result = await teamApi.startTreatment(id);
      navigation.navigate('Chat', { chatRoomId: result.chatRoomId });
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  if (!isWard && !isInstitution) {
    return (
      <Screen>
        <Notice tone="warning">보호자 계정은 진료 요청 화면을 사용할 수 없습니다.</Notice>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>
        {isWard ? '내 진료 요청' : '들어온 진료 요청'}
      </Text>
      <Text style={uiStyles.subtitle}>
        {isWard
          ? '기관의 응답을 확인하고 수락된 요청의 진료를 시작하세요.'
          : '대기 중인 요청을 검토하고 응답하세요.'}
      </Text>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Section title={`요청 ${requests.length}건`}>
        <Button
          title={loading ? '불러오는 중...' : '새로고침'}
          tone="secondary"
          onPress={load}
          disabled={loading}
        />
        {requests.length === 0 && !loading ? (
          <EmptyState>현재 표시할 진료 요청이 없습니다.</EmptyState>
        ) : (
          requests.map((request) => (
            <View key={request.medicalRequestId} style={styles.card}>
              <View style={uiStyles.row}>
                <Text style={styles.title}>
                  {isWard ? request.institutionUserName : request.wardUserName}
                </Text>
                <Text style={uiStyles.badge}>
                  {statusLabel[request.status] || request.status}
                </Text>
              </View>
              <Text style={uiStyles.subtitle}>요청 #{request.medicalRequestId}</Text>
              <Text style={uiStyles.subtitle}>
                {isWard
                  ? `기관 ID · ${request.institutionUserId}`
                  : `환자 ID · ${request.wardUserId}`}
              </Text>
              <Text style={styles.date}>{formatDate(request.createdAt)}</Text>
              {isInstitution && request.status === 'REQUESTED' ? (
                <View style={styles.actions}>
                  <Button title="수락" onPress={() => respond(request.medicalRequestId, true)} />
                  <Button
                    title="거절"
                    tone="danger"
                    onPress={() => respond(request.medicalRequestId, false)}
                  />
                </View>
              ) : null}
              {isWard && request.status === 'ACCEPTED' ? (
                <Button
                  title="진료 시작"
                  onPress={() => start(request.medicalRequestId)}
                  disabled={loading}
                />
              ) : null}
            </View>
          ))
        )}
      </Section>

      {isWard ? (
        <Button
          title="새 진료 요청"
          onPress={() => navigation.navigate('InstitutionSearch')}
        />
      ) : null}

      <Section
        title="진료 중인 대화방"
        description={
          isInstitution
            ? '현재 백엔드 응답에 채팅방 번호가 포함되지 않아 번호를 직접 입력해야 합니다.'
            : '이미 시작한 진료에 다시 입장할 때 채팅방 번호를 입력하세요.'
        }
      >
        <Field
          label="채팅방 번호"
          value={chatRoomId}
          onChangeText={setChatRoomId}
          keyboardType="number-pad"
          placeholder="예: 1"
        />
        <Button
          title="대화방 입장"
          onPress={() => navigation.navigate('Chat', { chatRoomId: Number(chatRoomId) })}
          disabled={!Number(chatRoomId)}
        />
      </Section>
    </Screen>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#fbfcfe',
    padding: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  date: {
    color: colors.muted,
    fontSize: 12,
  },
  actions: {
    gap: spacing.sm,
  },
});
