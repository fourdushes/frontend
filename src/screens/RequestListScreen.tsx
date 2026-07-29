import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  Screen,
  StatusBadge,
  Tabs,
  formatDate,
} from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { loadChatLinks, rememberChatLink } from '../storage/chatLinks';
import { colors, fontFamily, radius } from '../theme/theme';
import { MedicalRequest } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestList'>;
type Filter = 'ALL' | 'WAITING' | 'ACTIVE' | 'DONE';

const statusMeta = {
  REQUESTED: { label: '응답 대기', tone: 'warning' as const, step: 1 },
  ACCEPTED: { label: '수락됨', tone: 'primary' as const, step: 2 },
  REJECTED: { label: '거절됨', tone: 'danger' as const, step: 1 },
  IN_PROGRESS: { label: '진료 중', tone: 'primary' as const, step: 3 },
  COMPLETED: { label: '진료 완료', tone: 'success' as const, step: 4 },
  CANCELED: { label: '취소됨', tone: 'neutral' as const, step: 1 },
};

export function RequestListScreen({ navigation }: Props) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const compact = width < 920;
  const [filter, setFilter] = useState<Filter>('ALL');
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [chatLinks, setChatLinks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MedicalRequest | null>(null);
  const isWard = session?.userType === 'WARD';
  const isInstitution = session?.userType === 'INSTITUTIONS';

  const load = useCallback(async () => {
    if (!isWard && !isInstitution) return;
    setLoading(true);
    setError(null);
    try {
      const [items, links] = await Promise.all([
        isWard ? teamApi.getWardRequests() : teamApi.getInstitutionRequests(),
        loadChatLinks(),
      ]);
      setRequests(items ?? []);
      setChatLinks(links);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [isInstitution, isWard]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => requests.filter((request) => {
    if (filter === 'WAITING') return request.status === 'REQUESTED';
    if (filter === 'ACTIVE') return ['ACCEPTED', 'IN_PROGRESS'].includes(request.status);
    if (filter === 'DONE') return ['COMPLETED', 'REJECTED', 'CANCELED'].includes(request.status);
    return true;
  }), [filter, requests]);

  async function respond(request: MedicalRequest, accept: boolean) {
    if (processingId !== null) return;
    setProcessingId(request.medicalRequestId);
    setError(null);
    setNotice(null);
    try {
      if (accept) await teamApi.acceptRequest(request.medicalRequestId);
      else await teamApi.rejectRequest(request.medicalRequestId);
      setNotice(accept ? '진료 요청을 수락했습니다.' : '진료 요청을 거절했습니다.');
      await load();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setRejectTarget(null);
      setProcessingId(null);
    }
  }

  async function start(request: MedicalRequest) {
    if (processingId !== null) return;
    setProcessingId(request.medicalRequestId);
    setError(null);
    try {
      const result = await teamApi.startTreatment(request.medicalRequestId);
      const nextLinks = await rememberChatLink(request.medicalRequestId, result.chatRoomId);
      setChatLinks(nextLinks);
      navigation.navigate('Chat', {
        chatRoomId: result.chatRoomId,
        requestId: request.medicalRequestId,
      });
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setProcessingId(null);
    }
  }

  function enterChat(request: MedicalRequest) {
    const chatRoomId = chatLinks[String(request.medicalRequestId)];
    if (!chatRoomId) return;
    navigation.navigate('Chat', { chatRoomId, requestId: request.medicalRequestId });
  }

  if (session?.userType === 'GUARDIAN') {
    return (
      <Screen>
        <PageHeader
          eyebrow="ACCESS LIMITED"
          title="보호자는 진료 요청에 참여하지 않습니다."
          description="연결된 피보호자의 완료된 진료 기록은 아카이브에서 확인할 수 있습니다."
          actions={<Button title="진료 기록 보기" onPress={() => navigation.navigate('ArchiveList')} />}
        />
      </Screen>
    );
  }

  const counts = {
    waiting: requests.filter((request) => request.status === 'REQUESTED').length,
    active: requests.filter((request) => ['ACCEPTED', 'IN_PROGRESS'].includes(request.status)).length,
    done: requests.filter((request) => ['COMPLETED', 'REJECTED', 'CANCELED'].includes(request.status)).length,
  };
  const missingChatLink = requests.some(
    (request) => request.status === 'IN_PROGRESS' && !chatLinks[String(request.medicalRequestId)],
  );

  return (
    <Screen>
      <PageHeader
        eyebrow="TREATMENT REQUEST CENTER"
        title={isWard ? '내 진료 요청' : '도착한 진료 요청'}
        description={
          isWard
            ? '기관의 응답을 확인하고 수락된 요청에서 진료를 시작하세요.'
            : '피보호자의 요청을 검토하고 수락 또는 거절하세요.'
        }
        actions={
          <Button
            title={loading ? '새로고침 중…' : '새로고침'}
            tone="secondary"
            compact
            onPress={load}
            disabled={loading}
          />
        }
      />

      {error ? <Notice tone="error" title="요청을 처리하지 못했습니다.">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {missingChatLink ? (
        <Notice tone="warning" title="일부 진행 중 진료의 대화방 연결 정보가 없습니다.">
          현재 백엔드의 요청 목록 응답에는 채팅방 번호가 포함되지 않습니다. 이 기기에서 시작한 진료만 바로 다시 입장할 수 있습니다.
        </Notice>
      ) : null}

      <View style={styles.summaryGrid}>
        <SummaryCard label="응답 대기" value={counts.waiting} tone="warning" />
        <SummaryCard label="진료 가능·진행" value={counts.active} tone="primary" />
        <SummaryCard label="완료·종료" value={counts.done} tone="success" />
      </View>

      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'ALL', label: '전체', count: requests.length },
          { value: 'WAITING', label: '응답 대기', count: counts.waiting },
          { value: 'ACTIVE', label: '진료 가능·진행', count: counts.active },
          { value: 'DONE', label: '완료·종료', count: counts.done },
        ]}
      />

      <View style={styles.requestList}>
        {loading ? <LoadingState label="진료 요청을 불러오고 있습니다." /> : null}
        {!loading && !filtered.length ? (
          <EmptyState
            title={filter === 'ALL' ? '진료 요청이 없습니다.' : '이 상태의 요청이 없습니다.'}
            action={
              isWard ? (
                <Button title="새 진료 요청" onPress={() => navigation.navigate('InstitutionSearch')} />
              ) : undefined
            }
          >
            {isWard ? '기관을 검색해 첫 진료 요청을 보내보세요.' : '새로운 요청이 도착하면 이곳에 표시됩니다.'}
          </EmptyState>
        ) : null}
        {!loading && filtered.map((request) => {
          const meta = statusMeta[request.status];
          const chatRoomId = chatLinks[String(request.medicalRequestId)];
          if (request.status === 'COMPLETED' && isWard) {
            return (
              <View
                key={request.medicalRequestId}
                style={[styles.completedRequestRow, compact && styles.completedRequestRowCompact]}
              >
                <View style={styles.identity}>
                  <View style={styles.identityMark}>
                    <Text style={styles.identityMarkText}>{request.institutionUserName.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.identityCopy}>
                    <Text style={styles.personName}>{request.institutionUserName}</Text>
                    <Text style={styles.personMeta}>
                      기관 담당자 {request.institutionUserId} · {formatDate(request.completedAt || request.createdAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.completedRequestMeta}>
                  <StatusBadge label="진료 완료" tone="success" />
                  <Text style={styles.completedRequestNumber}>REQUEST #{request.medicalRequestId}</Text>
                </View>
                <Button
                  title="진료 기록 보기"
                  tone="secondary"
                  compact
                  onPress={() => navigation.navigate('ArchiveList')}
                />
              </View>
            );
          }
          return (
            <View key={request.medicalRequestId} style={styles.requestCard}>
              <View style={[styles.cardTop, compact && styles.cardTopCompact]}>
                <View style={styles.identity}>
                  <View style={styles.identityMark}>
                    <Text style={styles.identityMarkText}>
                      {(isWard ? request.institutionUserName : request.wardUserName).slice(0, 1)}
                    </Text>
                  </View>
                  <View style={styles.identityCopy}>
                    <Text style={styles.personName}>
                      {isWard ? request.institutionUserName : request.wardUserName}
                    </Text>
                    <Text style={styles.personMeta}>
                      {isWard ? `기관 담당자 ${request.institutionUserId}` : `피보호자 ${request.wardUserId}`}
                    </Text>
                  </View>
                </View>
                <StatusBadge label={meta.label} tone={meta.tone} />
              </View>

              <View style={[styles.progressTrack, compact && styles.progressTrackCompact]}>
                {[
                  ['요청', request.createdAt],
                  ['기관 응답', request.respondedAt],
                  ['진료 시작', request.startedAt],
                  ['진료 종료', request.completedAt],
                ].map(([label, time], index) => {
                  const active = index < meta.step && request.status !== 'REJECTED';
                  return (
                    <View key={label} style={styles.progressStep}>
                      <View style={[styles.progressDot, active && styles.progressDotActive]}>
                        <Text style={[styles.progressDotText, active && styles.progressDotTextActive]}>
                          {active ? '✓' : index + 1}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.progressLabel}>{label}</Text>
                        <Text style={styles.progressTime}>{time ? formatDate(time) : '대기 중'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.requestNumber}>
                  <Text style={styles.requestNumberLabel}>REQUEST</Text>
                  <Text style={styles.requestNumberValue}>#{request.medicalRequestId}</Text>
                </View>
                <View style={styles.cardActions}>
                  {isInstitution && request.status === 'REQUESTED' ? (
                    <>
                      <Button
                        title={processingId === request.medicalRequestId ? '처리 중…' : '요청 수락'}
                        compact
                        onPress={() => respond(request, true)}
                        disabled={processingId !== null}
                      />
                      <Button
                        title="거절"
                        tone="secondary"
                        compact
                        onPress={() => setRejectTarget(request)}
                        disabled={processingId !== null}
                      />
                    </>
                  ) : null}
                  {isWard && request.status === 'ACCEPTED' ? (
                    <Button
                      title={processingId === request.medicalRequestId ? '준비 중…' : '진료 시작'}
                      compact
                      onPress={() => start(request)}
                      disabled={processingId !== null}
                    />
                  ) : null}
                  {request.status === 'IN_PROGRESS' && chatRoomId ? (
                    <Button title="대화방 입장" compact onPress={() => enterChat(request)} />
                  ) : null}
                  {request.status === 'IN_PROGRESS' && !chatRoomId ? (
                    <StatusBadge label="대화방 정보 없음" tone="warning" />
                  ) : null}
                  {request.status === 'COMPLETED' && isWard ? (
                    <Button
                      title="진료 기록 보기"
                      tone="secondary"
                      compact
                      onPress={() => navigation.navigate('ArchiveList')}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {isWard ? (
        <Pressable onPress={() => navigation.navigate('InstitutionSearch')} style={styles.newRequestBanner}>
          <View>
            <Text style={styles.newRequestEyebrow}>NEED ANOTHER TREATMENT?</Text>
            <Text style={styles.newRequestTitle}>새로운 기관을 찾아 진료를 요청해 보세요.</Text>
          </View>
          <Text style={styles.newRequestLink}>기관 검색  →</Text>
        </Pressable>
      ) : null}

      <ConfirmDialog
        visible={Boolean(rejectTarget)}
        title="진료 요청을 거절할까요?"
        description={`${rejectTarget?.wardUserName ?? '선택한 피보호자'}님의 요청은 거절 상태로 변경됩니다.`}
        confirmLabel="요청 거절"
        destructive
        busy={processingId !== null}
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && respond(rejectTarget, false)}
      />
    </Screen>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'warning' | 'primary' | 'success';
}) {
  return (
    <View style={[
      styles.summaryCard,
      tone === 'warning' && styles.summaryWarning,
      tone === 'success' && styles.summarySuccess,
    ]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryUnit}>건</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryCard: { minWidth: 190, flex: 1, minHeight: 110, borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: 19 },
  summaryWarning: { backgroundColor: colors.warningSoft },
  summarySuccess: { backgroundColor: colors.successSoft },
  summaryLabel: { color: colors.textSoft, fontFamily, fontSize: 10, fontWeight: '800' },
  summaryValue: { color: colors.text, fontFamily, fontSize: 31, fontWeight: '900', marginTop: 10 },
  summaryUnit: { position: 'absolute', right: 18, bottom: 20, color: colors.muted, fontFamily, fontSize: 9, fontWeight: '900' },
  requestList: { gap: 12 },
  completedRequestRow: { minHeight: 112, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 18 },
  completedRequestRowCompact: { flexWrap: 'wrap', alignItems: 'center' },
  completedRequestMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  completedRequestNumber: { color: colors.faint, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  requestCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 22, gap: 19 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  cardTopCompact: { alignItems: 'flex-start' },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityMark: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  identityMarkText: { color: colors.primary, fontFamily, fontSize: 14, fontWeight: '900' },
  identityCopy: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '900' },
  personMeta: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 5 },
  progressTrack: { borderRadius: radius.md, backgroundColor: colors.surfaceSoft, padding: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progressTrackCompact: { flexWrap: 'wrap' },
  progressStep: { minWidth: 145, flexDirection: 'row', alignItems: 'center', gap: 9 },
  progressDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  progressDotText: { color: colors.faint, fontFamily, fontSize: 8, fontWeight: '900' },
  progressDotTextActive: { color: '#fff' },
  progressLabel: { color: colors.textSoft, fontFamily, fontSize: 9, fontWeight: '900' },
  progressTime: { color: colors.muted, fontFamily, fontSize: 8, marginTop: 3 },
  cardFooter: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  requestNumber: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestNumberLabel: { color: colors.faint, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  requestNumberValue: { color: colors.textSoft, fontFamily, fontSize: 9, fontWeight: '900' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  newRequestBanner: { minHeight: 100, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.primarySoft, paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  newRequestEyebrow: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  newRequestTitle: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '900', marginTop: 7 },
  newRequestLink: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
});
