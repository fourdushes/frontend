import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import {
  Button,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  Screen,
  StatusBadge,
  formatDate,
} from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius } from '../theme/theme';
import { ArchiveList, ConnectedWard } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchiveList'>;

export function ArchiveListScreen({ navigation }: Props) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const stacked = width < 1040;
  const [archives, setArchives] = useState<ArchiveList | null>(null);
  const [wards, setWards] = useState<ConnectedWard[]>([]);
  const [selectedWard, setSelectedWard] = useState<ConnectedWard | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isWard = session?.userType === 'WARD';
  const isGuardian = session?.userType === 'GUARDIAN';

  const loadArchives = useCallback(async (nextPage = 0, ward = selectedWard) => {
    if (!isWard && !isGuardian) return;
    if (isGuardian && !ward) return;
    setLoading(true);
    setError(null);
    try {
      const response = isWard
        ? await teamApi.getArchives(nextPage)
        : await teamApi.getGuardianArchives(ward!.wardUserId, nextPage);
      setArchives(response);
      setPage(nextPage);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [isGuardian, isWard, selectedWard]);

  useEffect(() => {
    if (isWard) {
      void loadArchives(0, null);
      return;
    }
    if (isGuardian) {
      setLoading(true);
      teamApi.getConnectedWards()
        .then((response) => {
          const next = response.wardSearchList ?? [];
          setWards(next);
          if (next[0]) {
            setSelectedWard(next[0]);
            void loadArchives(0, next[0]);
          }
        })
        .catch((caught) => setError(readableError(caught)))
        .finally(() => setLoading(false));
    }
  }, [isGuardian, isWard]);

  function chooseWard(ward: ConnectedWard) {
    setSelectedWard(ward);
    setArchives(null);
    void loadArchives(0, ward);
  }

  if (session?.userType === 'INSTITUTIONS') {
    return (
      <Screen>
        <PageHeader
          eyebrow="ACCESS LIMITED"
          title="기관 사용자의 아카이브 범위는 현재 제공되지 않습니다."
          description="현재 백엔드 권한은 피보호자 본인과 승인된 보호자의 기록 조회만 허용합니다."
          actions={<Button title="홈으로 이동" onPress={() => navigation.navigate('Home')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="CARE ARCHIVE"
        title={isGuardian ? '피보호자 진료 기록' : '나의 진료 기록'}
        description={
          isGuardian
            ? '승인된 케어 관계의 피보호자만 선택해 완료된 진료 기록을 확인합니다.'
            : '완료된 진료 대화와 저장된 요약을 시간순으로 확인하세요.'
        }
        actions={
          <Button
            title={loading ? '새로고침 중…' : '새로고침'}
            tone="secondary"
            compact
            onPress={() => loadArchives(page)}
            disabled={loading || (isGuardian && !selectedWard)}
          />
        }
      />

      {error ? <Notice tone="error" title="진료 기록을 불러오지 못했습니다.">{error}</Notice> : null}

      <View style={[styles.layout, stacked && styles.layoutStacked]}>
        {isGuardian ? (
          <View style={[styles.wardRail, stacked && styles.wardRailStacked]}>
            <Text style={styles.railEyebrow}>CONNECTED FAMILY</Text>
            <Text style={styles.railTitle}>피보호자 선택</Text>
            <Text style={styles.railDescription}>
              현재 승인된 연결 관계만 표시됩니다.
            </Text>
            <View style={styles.wardList}>
              {wards.map((ward) => {
                const active = selectedWard?.careId === ward.careId;
                return (
                  <Pressable
                    key={ward.careId}
                    accessibilityState={{ selected: active }}
                    onPress={() => chooseWard(ward)}
                    style={[styles.wardRow, active && styles.wardRowActive]}
                  >
                    <View style={[styles.wardAvatar, active && styles.wardAvatarActive]}>
                      <Text style={[styles.wardAvatarText, active && styles.wardAvatarTextActive]}>
                        {ward.wardUserName.slice(0, 1)}
                      </Text>
                    </View>
                    <View style={styles.wardCopy}>
                      <Text style={[styles.wardName, active && styles.wardNameActive]}>{ward.wardUserName}</Text>
                      <Text style={styles.wardId}>{ward.wardUserId}</Text>
                    </View>
                    <Text style={styles.wardArrow}>›</Text>
                  </Pressable>
                );
              })}
              {!wards.length && !loading ? (
                <Text style={styles.noWards}>승인된 피보호자 연결이 없습니다.</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={[styles.archiveArea, (!isGuardian || stacked) && styles.archiveAreaFull]}>
          <View style={styles.archiveHeader}>
            <View>
              <Text style={styles.archiveEyebrow}>COMPLETED RECORDS</Text>
              <Text style={styles.archiveTitle}>
                {isGuardian
                  ? selectedWard
                    ? `${selectedWard.wardUserName}님의 기록`
                    : '피보호자를 선택해 주세요.'
                  : '완료된 진료'}
              </Text>
            </View>
            <StatusBadge label={`전체 ${archives?.totalCount ?? 0}건`} tone="primary" />
          </View>

          {loading ? <LoadingState label="완료된 진료 기록을 불러오고 있습니다." /> : null}
          {!loading && (!archives || !archives.list.length) ? (
            <EmptyState title="완료된 진료 기록이 없습니다.">
              진료를 종료하고 아카이브가 생성되면 이곳에서 확인할 수 있습니다.
            </EmptyState>
          ) : null}

          {!loading && archives?.list.map((item, index) => (
            <Pressable
              key={item.archiveId}
              accessibilityRole="link"
              onPress={() => navigation.navigate('ArchiveDetail', { archiveId: item.archiveId })}
              style={({ pressed }) => [styles.archiveRow, pressed && styles.archiveRowPressed]}
            >
              <View style={styles.archiveDate}>
                <Text style={styles.archiveDay}>
                  {new Date(item.archiveDate).getDate() || index + 1}
                </Text>
                <Text style={styles.archiveMonth}>
                  {new Date(item.archiveDate).getMonth() + 1}월
                </Text>
              </View>
              <View style={styles.archiveCopy}>
                <View style={styles.archiveMetaRow}>
                  <StatusBadge label="진료 완료" tone="success" />
                  <Text style={styles.archiveMeta}>{formatDate(item.archiveDate)}</Text>
                </View>
                <Text style={styles.archiveName}>{item.archiveName || `진료 기록 #${item.archiveId}`}</Text>
                <Text style={styles.archiveHint}>저장된 진료 요약과 전체 대화 보기</Text>
              </View>
              <View style={styles.archiveId}>
                <Text style={styles.archiveIdLabel}>ARCHIVE</Text>
                <Text style={styles.archiveIdValue}>#{item.archiveId}</Text>
              </View>
              <Text style={styles.archiveArrow}>›</Text>
            </Pressable>
          ))}

          {archives ? (
            <View style={styles.pagination}>
              <Button
                title="이전"
                tone="secondary"
                compact
                onPress={() => loadArchives(Math.max(0, page - 1))}
                disabled={loading || page === 0}
              />
              <Text style={styles.pageLabel}>{page + 1} 페이지</Text>
              <Button
                title="다음"
                tone="secondary"
                compact
                onPress={() => loadArchives(page + 1)}
                disabled={loading || !archives.hasNext}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  layoutStacked: { flexDirection: 'column' },
  wardRail: { width: 285, borderRadius: radius.lg, backgroundColor: colors.ink, padding: 23 },
  wardRailStacked: { width: '100%' },
  railEyebrow: { color: '#d8f3ec', fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  railTitle: { color: '#fff', fontFamily, fontSize: 18, fontWeight: '900', marginTop: 7 },
  railDescription: { color: '#e0f0ec', fontFamily, fontSize: 9, lineHeight: 16, marginTop: 6 },
  wardList: { gap: 6, marginTop: 20 },
  wardRow: { minHeight: 62, borderRadius: radius.md, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  wardRowActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  wardAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  wardAvatarActive: { backgroundColor: '#fff' },
  wardAvatarText: { color: '#e0f0ec', fontFamily, fontSize: 11, fontWeight: '900' },
  wardAvatarTextActive: { color: colors.primaryDark },
  wardCopy: { flex: 1, minWidth: 0 },
  wardName: { color: '#e4f3ef', fontFamily, fontSize: 11, fontWeight: '900' },
  wardNameActive: { color: '#fff' },
  wardId: { color: '#c3dfd8', fontFamily, fontSize: 8, marginTop: 3 },
  wardArrow: { color: '#d8f3ec', fontFamily, fontSize: 19 },
  noWards: { color: '#d7e9e4', fontFamily, fontSize: 9, lineHeight: 16, paddingVertical: 16 },
  archiveArea: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 24 },
  archiveAreaFull: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  archiveHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  archiveEyebrow: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  archiveTitle: { color: colors.text, fontFamily, fontSize: 19, fontWeight: '900', marginTop: 6 },
  archiveRow: { minHeight: 112, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', gap: 15 },
  archiveRowPressed: { backgroundColor: colors.primarySoft },
  archiveDate: { width: 48, alignItems: 'center' },
  archiveDay: { color: colors.text, fontFamily, fontSize: 23, fontWeight: '900' },
  archiveMonth: { color: colors.muted, fontFamily, fontSize: 9 },
  archiveCopy: { flex: 1, minWidth: 0 },
  archiveMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  archiveMeta: { color: colors.muted, fontFamily, fontSize: 8 },
  archiveName: { color: colors.text, fontFamily, fontSize: 14, fontWeight: '900', marginTop: 9 },
  archiveHint: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 5 },
  archiveId: { alignItems: 'flex-end' },
  archiveIdLabel: { color: colors.faint, fontFamily, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  archiveIdValue: { color: colors.textSoft, fontFamily, fontSize: 9, fontWeight: '900', marginTop: 4 },
  archiveArrow: { color: colors.faint, fontFamily, fontSize: 24 },
  pagination: { minHeight: 60, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 5 },
  pageLabel: { color: colors.muted, fontFamily, fontSize: 9, fontWeight: '800' },
});
