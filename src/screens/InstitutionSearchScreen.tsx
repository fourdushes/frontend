import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Button, ConfirmDialog, Field, Notice, PageHeader, Screen, StatusBadge, formatDate } from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { useTreatmentRequest } from '../context/TreatmentRequestContext';
import { RootStackParamList } from '../navigation';
import { loadChatLinks, rememberChatLink } from '../storage/chatLinks';
import { colors, fontFamily, radius } from '../theme/theme';
import { Institution, MedicalRequest } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'InstitutionSearch'>;

const activeStatusMeta = {
  REQUESTED: {
    label: '수락 대기',
    tone: 'warning' as const,
    title: '기관 사용자의 응답을 기다리고 있습니다.',
    description: '요청이 수락되면 진료 채팅방을 준비해 자동으로 이동합니다.',
  },
  ACCEPTED: {
    label: '수락 완료',
    tone: 'primary' as const,
    title: '요청이 수락되어 채팅방을 준비하고 있습니다.',
    description: '잠시만 기다려 주세요. 같은 요청으로 중복 진료를 시작하지 않습니다.',
  },
  IN_PROGRESS: {
    label: '진료 진행 중',
    tone: 'primary' as const,
    title: '진료가 이미 시작되었습니다.',
    description: '이 기기에 저장된 채팅방 연결 정보를 확인하고 있습니다.',
  },
};

export function InstitutionSearchScreen({ navigation }: Props) {
  const { session } = useSession();
  const { requests, activeRequest, waitingRequest, ready, syncing, error: requestSyncError, adoptRequest } = useTreatmentRequest();
  const { width } = useWindowDimensions();
  const stacked = width < 1000;
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Institution[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedNotice, setResolvedNotice] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [exitBlocked, setExitBlocked] = useState(false);
  const searchSequence = useRef(0);
  const trackedRequestId = useRef<number | null>(null);
  const autoStartRequestId = useRef<number | null>(null);

  useEffect(() => {
    if (session?.userType !== 'WARD' || activeRequest || !ready || requestSyncError) {
      setResults([]);
      setSearching(false);
      return;
    }
    const query = keyword.trim();
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }

    const sequence = ++searchSequence.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const response = await teamApi.searchInstitutions(query);
        if (sequence === searchSequence.current) {
          setResults(response ?? []);
          setActiveIndex(0);
        }
      } catch (caught) {
        if (sequence === searchSequence.current) setError(readableError(caught));
      } finally {
        if (sequence === searchSequence.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [activeRequest, keyword, ready, requestSyncError, session?.userType]);

  useEffect(() => {
    if (activeRequest) {
      trackedRequestId.current = activeRequest.medicalRequestId;
      setResolvedNotice(null);
      return;
    }
    if (!trackedRequestId.current) return;
    const resolved = requests.find((request) => request.medicalRequestId === trackedRequestId.current);
    if (resolved?.status === 'REJECTED') {
      setResolvedNotice('기관 사용자가 요청을 거절했습니다. 다른 기관 사용자를 검색해 다시 요청할 수 있습니다.');
    } else if (resolved?.status === 'CANCELED') {
      setResolvedNotice('진료 요청이 취소되었습니다. 새로운 요청을 보낼 수 있습니다.');
    }
    trackedRequestId.current = null;
  }, [activeRequest, requests]);

  useEffect(() => {
    if (!activeRequest || !['ACCEPTED', 'IN_PROGRESS'].includes(activeRequest.status)) return;
    if (autoStartRequestId.current === activeRequest.medicalRequestId) return;
    autoStartRequestId.current = activeRequest.medicalRequestId;
    let disposed = false;

    const enterAcceptedTreatment = async () => {
      setStartingId(activeRequest.medicalRequestId);
      setError(null);
      try {
        const links = await loadChatLinks();
        const chatRoomId = activeRequest.chatRoomId ?? links[String(activeRequest.medicalRequestId)];
        if (chatRoomId) {
          if (!disposed) navigation.replace('Chat', { chatRoomId, requestId: activeRequest.medicalRequestId });
          return;
        }
        if (activeRequest.status === 'IN_PROGRESS') {
          throw new Error('진료는 시작되었지만 현재 API 응답에 채팅방 번호가 없어 이 기기에서는 자동으로 입장할 수 없습니다.');
        }
        const result = await teamApi.startTreatment(activeRequest.medicalRequestId);
        await rememberChatLink(activeRequest.medicalRequestId, result.chatRoomId);
        adoptRequest({ ...activeRequest, status: 'IN_PROGRESS', startedAt: new Date().toISOString(), chatRoomId: result.chatRoomId, archiveId: result.archiveId });
        if (!disposed) navigation.replace('Chat', { chatRoomId: result.chatRoomId, requestId: activeRequest.medicalRequestId });
      } catch (caught) {
        if (!disposed) {
          setError(readableError(caught));
          autoStartRequestId.current = null;
        }
      } finally {
        if (!disposed) setStartingId(null);
      }
    };

    void enterAcceptedTreatment();
    return () => {
      disposed = true;
    };
  }, [activeRequest, adoptRequest, navigation]);

  useEffect(() => {
    if (!waitingRequest) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();
      setExitBlocked(true);
    });
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [navigation, waitingRequest]);

  async function requestTreatment(institution: Institution) {
    if (requestingId || activeRequest || !ready || requestSyncError) return;
    setRequestingId(institution.institutionUserId);
    setError(null);
    setResolvedNotice(null);
    try {
      const next = await teamApi.createMedicalRequest(institution.institutionUserId);
      adoptRequest(next);
      trackedRequestId.current = next.medicalRequestId;
      setKeyword('');
      setResults([]);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setRequestingId(null);
    }
  }

  function handleKey(key: string) {
    if (!results.length || activeRequest) return;
    if (key === 'ArrowDown') setActiveIndex((value) => Math.min(results.length - 1, value + 1));
    if (key === 'ArrowUp') setActiveIndex((value) => Math.max(0, value - 1));
    if (key === 'Enter') void requestTreatment(results[activeIndex]);
    if (key === 'Escape') setResults([]);
  }

  if (session?.userType !== 'WARD') {
    return (
      <Screen>
        <PageHeader
          eyebrow="ACCESS LIMITED"
          title="진료 요청은 피보호자 계정에서 시작합니다."
          description="기관 사용자는 받은 요청을 확인하고, 보호자는 연결된 가족의 기록을 확인합니다."
          actions={<Button title="홈으로 이동" onPress={() => navigation.navigate('Home')} />}
        />
      </Screen>
    );
  }

  const activeMeta = activeRequest ? activeStatusMeta[activeRequest.status as keyof typeof activeStatusMeta] : null;
  const searchDisabled = Boolean(activeRequest) || !ready || Boolean(requestSyncError);

  return (
    <Screen>
      <PageHeader
        eyebrow="NEW TREATMENT REQUEST"
        title="진료 요청과 응답을 한곳에서 확인하세요."
        description="기관 사용자를 검색해 요청하면 이 화면에서 응답을 기다리고, 수락 시 진료 대화로 자동 이동합니다."
      />

      {requestSyncError ? <Notice tone="error" title="현재 요청 상태를 확인하지 못했습니다.">{requestSyncError} 새 요청은 상태 확인 후에만 보낼 수 있습니다.</Notice> : null}
      {error ? <Notice tone="error" title="요청을 처리하지 못했습니다.">{error}</Notice> : null}
      {resolvedNotice ? <Notice tone="success" title="현재 요청이 종료되었습니다.">{resolvedNotice}</Notice> : null}

      <View style={styles.layout}>
        <View style={[styles.searchStage, stacked && styles.searchStageStacked, searchDisabled && styles.searchStageDisabled]}>
          <View style={[styles.searchNarrative, stacked && styles.searchNarrativeStacked]}>
            <View style={styles.railEyebrowRow}>
              <View style={styles.railEyebrowDot} />
              <Text style={styles.railEyebrow}>STEP 01 · 기관 선택</Text>
            </View>
            <Text style={styles.railTitle}>{activeRequest ? '현재 요청의 응답을\n기다리고 있습니다.' : '어디에서 진료받을지\n검색으로 시작하세요.'}</Text>
            <Text style={styles.railDescription}>
              {activeRequest
                ? '활성 요청이 종료되기 전에는 새로운 기관 사용자에게 요청할 수 없습니다.'
                : '기관 이름 또는 담당자 아이디를 입력하고, 검색 결과에서 요청할 대상을 정확히 확인해 주세요.'}
            </Text>
          </View>

          <View style={[styles.searchBox, stacked && styles.searchBoxStacked]}>
            <View style={styles.searchBoxHeader}>
              <Text style={styles.searchBoxTitle}>기관·담당자 검색</Text>
              <StatusBadge label={activeRequest ? '요청 중 잠금' : '자동 검색'} tone={activeRequest ? 'warning' : 'primary'} />
            </View>
            <Field
              label="검색어"
              value={keyword}
              editable={!searchDisabled}
              onChangeText={setKeyword}
              onKeyPress={(event) => handleKey(event.nativeEvent.key)}
              placeholder={activeRequest ? '현재 요청이 종료된 뒤 다시 검색할 수 있습니다.' : '기관명 또는 담당자 아이디'}
              hint={activeRequest ? '한 번에 한 건의 요청만 진행할 수 있습니다.' : '입력을 멈추면 바로 검색합니다.'}
            />
            {!searchDisabled && keyword.trim() ? (
              <View accessibilityRole="menu" style={styles.searchDropdown}>
                <View style={styles.searchDropdownHeader}>
                  <Text style={styles.searchDropdownTitle}>검색된 기관 사용자</Text>
                  <StatusBadge label={`${results.length}명`} tone="primary" />
                </View>
                {searching ? <DropdownState icon="…" title="기관 사용자를 검색하고 있습니다." description="잠시만 기다려 주세요." /> : null}
                {!searching && !results.length ? <DropdownState icon="?" title="검색 결과가 없습니다." description="기관명이나 담당자 아이디를 다시 확인해 주세요." /> : null}
                {!searching && results.map((item, index) => (
                  <Pressable
                    key={item.institutionUserId}
                    accessibilityRole="menuitem"
                    onPress={() => requestTreatment(item)}
                    style={[styles.institutionRow, stacked && styles.institutionRowStacked, index === activeIndex && styles.institutionRowActive]}
                  >
                    <View style={styles.institutionIdentity}>
                      <View style={styles.institutionMark}><Text style={styles.institutionMarkText}>H</Text></View>
                      <View style={styles.institutionCopy}>
                        <Text style={styles.institutionName}>{item.name}</Text>
                        <Text style={styles.institutionMeta}>기관 사용자 {item.institutionUserId} · {item.email}</Text>
                      </View>
                    </View>
                    <View style={[styles.institutionAction, stacked && styles.institutionActionStacked]}>
                      <View style={styles.availability}><View style={styles.availabilityDot} /><Text style={styles.availabilityText}>진료 요청 가능</Text></View>
                      <View style={[styles.requestButton, stacked && styles.requestButtonStacked]}>
                        <Button title={requestingId === item.institutionUserId ? '요청 중…' : '요청하기'} compact onPress={() => requestTreatment(item)} disabled={requestingId !== null} />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.searchBoxHint}>
              <Text style={styles.searchBoxHintIcon}>✓</Text>
              <Text style={styles.searchBoxHintText}>등록된 기관 사용자만 검색 결과에 표시됩니다.</Text>
            </View>
          </View>
        </View>

        {activeRequest && activeMeta ? (
          <View style={styles.activeRequestCard}>
            <View style={[styles.activeRequestTop, stacked && styles.activeRequestTopStacked]}>
              <View style={styles.activeRequestIdentity}>
                <View style={styles.activeRequestMark}><Text style={styles.activeRequestMarkText}>{activeRequest.institutionUserName.slice(0, 1)}</Text></View>
                <View style={styles.activeRequestCopy}>
                  <Text style={styles.activeRequestEyebrow}>CURRENT REQUEST · #{activeRequest.medicalRequestId}</Text>
                  <Text style={styles.activeRequestName}>{activeRequest.institutionUserName}</Text>
                  <Text style={styles.activeRequestMeta}>기관 사용자 {activeRequest.institutionUserId} · {formatDate(activeRequest.createdAt)}</Text>
                </View>
              </View>
              <StatusBadge label={startingId ? '채팅방 준비 중' : activeMeta.label} tone={activeMeta.tone} />
            </View>
            <View style={styles.activeRequestStatus}>
              <View style={styles.statusPulse} />
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>{startingId ? '수락을 확인해 진료 채팅방을 만들고 있습니다.' : activeMeta.title}</Text>
                <Text style={styles.statusDescription}>{activeMeta.description}</Text>
              </View>
              {activeRequest.status === 'REQUESTED' ? <Button title="취소하기" tone="secondary" compact onPress={() => setCancelOpen(true)} /> : null}
            </View>
            {activeRequest.status === 'REQUESTED' ? (
              <Notice tone="warning">응답 대기 중에는 다른 메뉴로 이동할 수 없습니다. 현재 서버에는 요청 취소 API가 없어 취소 버튼은 연결 안내만 제공합니다.</Notice>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.railGuide, stacked && styles.railGuideStacked]}>
          {[
            ['01', '기관 검색', '기관명이나 담당자 아이디 입력'],
            ['02', '요청 보내기', '검색 결과에서 한 명에게 요청'],
            ['03', '응답 대기', '수락 시 채팅방으로 자동 이동'],
          ].map(([number, label, description]) => (
            <View key={number} style={styles.guideRow}>
              <Text style={styles.guideNumberText}>{number}</Text>
              <View style={styles.guideCopy}><Text style={styles.guideTitle}>{label}</Text><Text style={styles.guideText}>{description}</Text></View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.bottomGuide, stacked && styles.bottomGuideStacked]}>
        <View>
          <Text style={styles.bottomGuideTitle}>{syncing ? '최신 요청 상태를 확인하고 있습니다.' : '요청 상태는 이 화면에서 자동으로 갱신됩니다.'}</Text>
          <Text style={styles.bottomGuideText}>완료된 진료 내용은 기존 진료 기록에서 확인할 수 있습니다.</Text>
        </View>
        <StatusBadge label={activeRequest ? '현재 요청 있음' : '새 요청 가능'} tone={activeRequest ? 'warning' : 'success'} />
      </View>

      <ConfirmDialog
        visible={cancelOpen}
        title="진료 요청을 취소하시겠습니까?"
        description="현재 백엔드에는 피보호자 진료 요청 취소 API가 없습니다. 실제 취소는 처리되지 않으며, API가 추가되면 이 확인 단계에 연결할 예정입니다."
        confirmLabel="확인"
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => setCancelOpen(false)}
      />
      <ConfirmDialog
        visible={exitBlocked}
        title="현재 요청 화면을 유지해 주세요."
        description={`${waitingRequest?.institutionUserName ?? '기관 사용자'}의 응답을 기다리는 동안에는 다른 페이지로 이동할 수 없습니다.`}
        confirmLabel="계속 기다리기"
        onCancel={() => setExitBlocked(false)}
        onConfirm={() => setExitBlocked(false)}
      />
    </Screen>
  );
}

function DropdownState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.dropdownState}>
      <Text style={styles.dropdownStateIcon}>{icon}</Text>
      <View style={styles.dropdownStateCopy}><Text style={styles.dropdownStateTitle}>{title}</Text><Text style={styles.dropdownStateText}>{description}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { width: '100%', borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.xl, backgroundColor: colors.primarySoft, padding: 26, gap: 22, overflow: 'hidden' },
  searchStage: { flexDirection: 'row', alignItems: 'stretch', gap: 24 },
  searchStageStacked: { flexDirection: 'column', gap: 20 },
  searchStageDisabled: { opacity: 0.78 },
  searchNarrative: { flex: 1, minWidth: 0, padding: 8, justifyContent: 'center' },
  searchNarrativeStacked: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  railEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  railEyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  railEyebrow: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  railTitle: { color: colors.text, fontFamily, fontSize: 26, lineHeight: 37, fontWeight: '900', letterSpacing: -0.6, marginTop: 14 },
  railDescription: { maxWidth: 520, color: colors.textSoft, fontFamily, fontSize: 11, lineHeight: 19, marginTop: 11 },
  searchBox: { flex: 1.15, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 20, gap: 12 },
  searchBoxStacked: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  searchBoxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  searchBoxTitle: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  searchBoxHint: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBoxHintIcon: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.successSoft, color: colors.success, fontFamily, fontSize: 10, fontWeight: '900', textAlign: 'center', lineHeight: 19 },
  searchBoxHintText: { flex: 1, color: colors.muted, fontFamily, fontSize: 9, lineHeight: 15 },
  searchDropdown: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  searchDropdownHeader: { minHeight: 42, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.canvas, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  searchDropdownTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  dropdownState: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  dropdownStateIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.surfaceSoft, color: colors.primary, fontFamily, fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 30 },
  dropdownStateCopy: { flex: 1, minWidth: 0 },
  dropdownStateTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  dropdownStateText: { color: colors.muted, fontFamily, fontSize: 8, lineHeight: 14, marginTop: 3 },
  institutionRow: { minHeight: 76, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 14 },
  institutionRowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  institutionRowActive: { backgroundColor: colors.primarySoft },
  institutionIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 13 },
  institutionMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  institutionMarkText: { color: colors.primary, fontFamily, fontSize: 15, fontWeight: '900' },
  institutionCopy: { flex: 1, minWidth: 0 },
  institutionName: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  institutionMeta: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 5 },
  institutionAction: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  institutionActionStacked: { width: '100%', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, justifyContent: 'space-between' },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  availabilityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  availabilityText: { color: colors.muted, fontFamily, fontSize: 8, fontWeight: '800' },
  requestButton: { minWidth: 110 },
  requestButtonStacked: { minWidth: 130 },
  activeRequestCard: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 20, gap: 16 },
  activeRequestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  activeRequestTopStacked: { alignItems: 'flex-start', flexDirection: 'column' },
  activeRequestIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 13 },
  activeRequestMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  activeRequestMarkText: { color: '#fff', fontFamily, fontSize: 16, fontWeight: '900' },
  activeRequestCopy: { flex: 1, minWidth: 0 },
  activeRequestEyebrow: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  activeRequestName: { color: colors.text, fontFamily, fontSize: 17, fontWeight: '900', marginTop: 5 },
  activeRequestMeta: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 5 },
  activeRequestStatus: { borderRadius: radius.md, backgroundColor: colors.canvas, padding: 16, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  statusPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  statusCopy: { flex: 1, minWidth: 220 },
  statusTitle: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  statusDescription: { color: colors.muted, fontFamily, fontSize: 9, lineHeight: 15, marginTop: 4 },
  railGuide: { flexDirection: 'row', borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 8, gap: 8 },
  railGuideStacked: { flexDirection: 'column' },
  guideRow: { flex: 1, minWidth: 0, borderRadius: radius.md, backgroundColor: colors.surfaceSoft, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  guideNumberText: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  guideCopy: { flex: 1, minWidth: 0 },
  guideTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  guideText: { color: colors.muted, fontFamily, fontSize: 8, marginTop: 3 },
  bottomGuide: { borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
  bottomGuideStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  bottomGuideTitle: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  bottomGuideText: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 4 },
});
