import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Button, EmptyState, Notice, Screen, Section, uiStyles } from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, spacing } from '../theme/theme';
import { ArchiveList } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchiveList'>;

export function ArchiveListScreen({ navigation }: Props) {
  const { session } = useSession();
  const [result, setResult] = useState<ArchiveList | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await teamApi.getArchives(nextPage));
      setPage(nextPage);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load(0);
  }, []);

  if (session?.userType !== 'WARD') {
    return (
      <Screen>
        <Notice tone="warning">현재 진료 기록 목록은 환자 계정에서만 조회할 수 있습니다.</Notice>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>진료 기록</Text>
      <Text style={uiStyles.subtitle}>완료된 진료의 저장된 대화와 요약을 확인하세요.</Text>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Section title={`전체 ${result?.totalCount ?? 0}건`}>
        <Button
          title={loading ? '불러오는 중...' : '새로고침'}
          tone="secondary"
          onPress={() => load(page)}
          disabled={loading}
        />
        {result?.list.length === 0 && !loading ? (
          <EmptyState>아직 완료된 진료 기록이 없습니다.</EmptyState>
        ) : (
          result?.list.map((item) => (
            <View key={item.archiveId} style={styles.card}>
              <Text style={styles.title}>
                {item.archiveName || item.arhciveName || `진료 기록 #${item.archiveId}`}
              </Text>
              <Text style={uiStyles.subtitle}>{formatDate(item.archiveDate)}</Text>
              <Button
                title="기록 보기"
                tone="secondary"
                onPress={() =>
                  navigation.navigate('ArchiveDetail', { archiveId: item.archiveId })
                }
              />
            </View>
          ))
        )}
      </Section>
      <View style={uiStyles.row}>
        <View style={uiStyles.flex}>
          <Button
            title="이전"
            tone="secondary"
            onPress={() => load(Math.max(0, page - 1))}
            disabled={loading || page === 0}
          />
        </View>
        <View style={uiStyles.flex}>
          <Button
            title="다음"
            tone="secondary"
            onPress={() => load(page + 1)}
            disabled={loading || !result?.hasNext}
          />
        </View>
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
});
