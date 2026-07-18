import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Button, EmptyState, Field, Notice, Screen, Section, uiStyles } from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { colors, spacing } from '../theme/theme';
import { CareListItem, WardSearchItem } from '../types/api';

const stateLabel: Record<string, string> = {
  WAITING: '승인 대기',
  PENDING: '승인 대기',
  APPROVED: '연결됨',
  REJECTED: '거절됨',
};

export function CareScreen() {
  const { session } = useSession();
  const [wardUserId, setWardUserId] = useState('');
  const [results, setResults] = useState<WardSearchItem[]>([]);
  const [careList, setCareList] = useState<CareListItem[]>([]);
  const [careId, setCareId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isWard = session?.userType === 'WARD';
  const isGuardian = session?.userType === 'GUARDIAN';

  const load = useCallback(async () => {
    if (!isWard && !isGuardian) return;
    setLoading(true);
    setError(null);
    try {
      const result = isWard
        ? await teamApi.getWardCareList()
        : await teamApi.getGuardianCareList();
      setCareList(result?.careList ?? []);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [isGuardian, isWard]);

  useEffect(() => {
    load();
  }, [load]);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const result = await teamApi.searchWard(wardUserId.trim());
      setResults(result?.wardUserList ?? []);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function request(item: WardSearchItem) {
    setLoading(true);
    setError(null);
    try {
      const result = await teamApi.requestCare(item.wardUserId);
      setNotice(`${item.wardUserName}님에게 연결 요청을 보냈습니다. 요청 번호는 ${result.careId}입니다.`);
      await load();
    } catch (caught) {
      setError(readableError(caught));
      setLoading(false);
    }
  }

  async function change(approve: boolean) {
    setLoading(true);
    setError(null);
    try {
      if (approve) await teamApi.approveCare(Number(careId));
      else await teamApi.rejectCare(Number(careId));
      setNotice(approve ? '보호자 연결을 승인했습니다.' : '보호자 연결을 거절했습니다.');
      setCareId('');
      await load();
    } catch (caught) {
      setError(readableError(caught));
      setLoading(false);
    }
  }

  if (!isWard && !isGuardian) {
    return (
      <Screen>
        <Notice tone="warning">의료기관 계정은 보호자 연결 기능을 사용하지 않습니다.</Notice>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>{isWard ? '보호자 연결 요청' : '환자 연결'}</Text>
      <Text style={uiStyles.subtitle}>
        {isWard
          ? '보호자가 보낸 연결 요청을 확인합니다.'
          : '보호할 환자를 검색하고 연결을 신청합니다.'}
      </Text>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice>{notice}</Notice> : null}

      {isGuardian ? (
        <Section title="환자 찾기">
          <Field
            label="환자 아이디"
            value={wardUserId}
            onChangeText={setWardUserId}
            placeholder="환자 아이디 입력"
            onSubmitEditing={search}
          />
          <Button
            title={loading ? '검색 중...' : '검색'}
            onPress={search}
            disabled={loading || !wardUserId.trim()}
          />
          {results.map((item) => (
            <View key={item.wardUserId} style={styles.card}>
              <Text style={styles.title}>{item.wardUserName}</Text>
              <Text style={uiStyles.subtitle}>{item.wardUserId}</Text>
              <Button title="연결 신청" onPress={() => request(item)} disabled={loading} />
            </View>
          ))}
        </Section>
      ) : null}

      <Section title={isWard ? '받은 요청·연결 목록' : '내 연결 현황'}>
        <Button
          title={loading ? '불러오는 중...' : '새로고침'}
          tone="secondary"
          onPress={load}
          disabled={loading}
        />
        {careList.length === 0 && !loading ? (
          <EmptyState>표시할 보호자 연결이 없습니다.</EmptyState>
        ) : (
          careList.map((item, index) => (
            <View key={`${item.guardUserId}-${item.wardUserId}-${index}`} style={styles.card}>
              <Text style={styles.title}>
                {isWard ? `보호자 ${item.guardUserId}` : `환자 ${item.wardUserId}`}
              </Text>
              <Text style={uiStyles.badge}>
                {stateLabel[item.careState] || item.careState}
              </Text>
              <Text style={uiStyles.subtitle}>{formatDate(item.createdAt)}</Text>
            </View>
          ))
        )}
      </Section>

      {isWard ? (
        <Section
          title="대기 요청 승인·거절"
          description="현재 백엔드 목록 응답에 요청 번호가 없어 보호자가 받은 요청 번호를 입력해야 합니다."
        >
          <Field
            label="연결 요청 번호"
            value={careId}
            onChangeText={setCareId}
            keyboardType="number-pad"
            placeholder="예: 1"
          />
          <Button title="연결 승인" onPress={() => change(true)} disabled={!Number(careId) || loading} />
          <Button
            title="연결 거절"
            tone="danger"
            onPress={() => change(false)}
            disabled={!Number(careId) || loading}
          />
        </Section>
      ) : null}
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
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
});
