import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  Field,
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
import { colors, fontFamily, radius } from '../theme/theme';
import { CareListItem, WardSearchItem } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Care'>;
type GuardianTab = 'SEARCH' | 'STATUS';

export function CareScreen({ navigation }: Props) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const stacked = width < 980;
  const [guardianTab, setGuardianTab] = useState<GuardianTab>('SEARCH');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<WardSearchItem[]>([]);
  const [careList, setCareList] = useState<CareListItem[]>([]);
  const [activeResult, setActiveResult] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [processingId, setProcessingId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CareListItem | null>(null);
  const searchSequence = useRef(0);
  const isWard = session?.userType === 'WARD';
  const isGuardian = session?.userType === 'GUARDIAN';

  const load = useCallback(async () => {
    if (!isWard && !isGuardian) return;
    setLoading(true);
    setError(null);
    try {
      const response = isWard
        ? await teamApi.getWardCareList()
        : await teamApi.getGuardianCareList();
      setCareList(response.careList ?? []);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [isGuardian, isWard]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isGuardian) return;
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
        const response = await teamApi.searchWard(query);
        if (sequence === searchSequence.current) {
          setResults(response.wardUserList ?? []);
          setActiveResult(0);
        }
      } catch (caught) {
        if (sequence === searchSequence.current) setError(readableError(caught));
      } finally {
        if (sequence === searchSequence.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isGuardian, keyword]);

  async function requestCare(item: WardSearchItem) {
    if (processingId !== null) return;
    setProcessingId(item.wardUserId);
    setError(null);
    setNotice(null);
    try {
      await teamApi.requestCare(item.wardUserId);
      setNotice(`${item.wardUserName}님에게 연결을 신청했습니다.`);
      setResults((current) => current.filter((result) => result.wardUserId !== item.wardUserId));
      await load();
      setGuardianTab('STATUS');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setProcessingId(null);
    }
  }

  async function changeCare(item: CareListItem, approve: boolean) {
    if (processingId !== null) return;
    setProcessingId(item.careId);
    setError(null);
    setNotice(null);
    try {
      if (approve) await teamApi.approveCare(item.careId);
      else await teamApi.rejectCare(item.careId);
      setCareList((current) => current.filter((care) => care.careId !== item.careId));
      setNotice(
        approve
          ? `${item.guardUserId}님의 연결 신청을 승인했습니다.`
          : `${item.guardUserId}님의 연결 신청을 거절했습니다.`,
      );
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setRejectTarget(null);
      setProcessingId(null);
    }
  }

  function handleSearchKey(key: string) {
    if (!results.length) return;
    if (key === 'ArrowDown') setActiveResult((value) => Math.min(results.length - 1, value + 1));
    if (key === 'ArrowUp') setActiveResult((value) => Math.max(0, value - 1));
    if (key === 'Enter') void requestCare(results[activeResult]);
    if (key === 'Escape') setResults([]);
  }

  if (session?.userType === 'INSTITUTIONS') {
    return (
      <Screen>
        <PageHeader
          eyebrow="ACCESS LIMITED"
          title="기관 사용자에게는 케어 서비스가 제공되지 않습니다."
          description="역할별 권한 정책에 따라 케어 연결 메뉴와 데이터 요청이 제한됩니다."
          actions={<Button title="홈으로 이동" onPress={() => navigation.navigate('Home')} />}
        />
      </Screen>
    );
  }

  const pendingIncoming = careList.filter((item) => item.careState === 'PENDING');
  const pendingSent = careList.filter((item) => item.careState === 'PENDING');

  return (
    <Screen>
      <PageHeader
        eyebrow="CARE CONNECTION"
        title={isWard ? '보호자 연결 요청' : '피보호자 연결'}
        description={
          isWard
            ? '나에게 도착한 보호자의 연결 신청을 확인하고 승인 또는 거절하세요.'
            : '피보호자를 찾아 연결을 신청하고 현재 상태를 확인하세요.'
        }
        actions={
          <Button
            title="연결 정보 보기"
            tone="secondary"
            compact
            onPress={() => navigation.navigate('Settings')}
          />
        }
      />

      {error ? <Notice tone="error" title="요청을 처리하지 못했습니다.">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {isGuardian ? (
        <>
          <Tabs
            value={guardianTab}
            onChange={setGuardianTab}
            options={[
              { value: 'SEARCH', label: '피보호자 찾기' },
              { value: 'STATUS', label: '보낸 연결 신청', count: careList.length },
            ]}
          />

          {guardianTab === 'SEARCH' ? (
            <View style={styles.searchWorkspace}>
              <View style={[styles.searchComposer, stacked && styles.searchComposerStacked]}>
                <View style={[styles.searchIntro, stacked && styles.searchIntroStacked]}>
                  <View style={styles.searchEyebrowRow}>
                    <View style={styles.searchEyebrowDot} />
                    <Text style={styles.searchEyebrow}>FIND YOUR FAMILY</Text>
                  </View>
                  <Text style={styles.searchTitle}>함께 기록을 확인할{'\n'}피보호자를 찾아보세요.</Text>
                  <Text style={styles.searchDescription}>
                    피보호자 계정의 아이디로 검색합니다. 이름과 아이디를 확인한 뒤 연결을 신청해 주세요.
                  </Text>
                </View>

                <View style={[styles.searchControl, stacked && styles.searchControlStacked]}>
                  <View style={styles.searchControlHeader}>
                    <Text style={styles.searchControlLabel}>피보호자 아이디 검색</Text>
                    <StatusBadge label="자동 검색" tone="primary" />
                  </View>
                  <Field
                    label="검색할 아이디"
                    value={keyword}
                    onChangeText={setKeyword}
                    onKeyPress={(event) => handleSearchKey(event.nativeEvent.key)}
                    placeholder="예: ward-user"
                    hint="입력을 멈추면 바로 검색합니다."
                  />
                  {keyword.trim() ? (
                    <View accessibilityRole="menu" style={styles.searchDropdown}>
                      <View style={styles.searchDropdownHeader}>
                        <Text style={styles.searchDropdownTitle}>검색된 피보호자 사용자</Text>
                        <StatusBadge label={`${results.length}명`} tone="primary" />
                      </View>
                      {searching ? (
                        <View style={styles.dropdownState}>
                          <Text style={styles.dropdownStateIcon}>…</Text>
                          <View style={styles.dropdownStateCopy}>
                            <Text style={styles.dropdownStateTitle}>피보호자를 검색하고 있습니다.</Text>
                            <Text style={styles.dropdownStateText}>잠시만 기다려 주세요.</Text>
                          </View>
                        </View>
                      ) : null}
                      {!searching && !results.length ? (
                        <View style={styles.dropdownState}>
                          <Text style={styles.dropdownStateIcon}>?</Text>
                          <View style={styles.dropdownStateCopy}>
                            <Text style={styles.dropdownStateTitle}>검색 결과가 없습니다.</Text>
                            <Text style={styles.dropdownStateText}>아이디 철자와 띄어쓰기를 다시 확인해 주세요.</Text>
                          </View>
                        </View>
                      ) : null}
                      {!searching && results.length ? results.map((item, index) => {
                        const current = careList.find((care) => care.wardUserId === item.wardUserId);
                        return (
                          <Pressable
                            key={item.wardUserId}
                            accessibilityRole="menuitem"
                            onPress={() => !current && requestCare(item)}
                            style={[
                              styles.resultRow,
                              stacked && styles.resultRowStacked,
                              index === activeResult && styles.resultRowActive,
                            ]}
                          >
                            <View style={styles.resultIdentity}>
                              <View style={styles.resultAvatar}>
                                <Text style={styles.resultAvatarText}>{item.wardUserName.slice(0, 1)}</Text>
                              </View>
                              <View style={styles.resultCopy}>
                                <Text style={styles.resultName}>{item.wardUserName}</Text>
                                <Text style={styles.resultId}>{item.wardUserId}</Text>
                              </View>
                            </View>
                            {current ? (
                              <StatusBadge
                                label={current.careState === 'PENDING' ? '신청 대기 중' : current.careState === 'APPROVED' ? '연결됨' : '재신청 가능'}
                                tone={current.careState === 'PENDING' ? 'warning' : current.careState === 'APPROVED' ? 'success' : 'danger'}
                              />
                            ) : (
                              <View style={[styles.resultButton, stacked && styles.resultButtonStacked]}>
                                <Button
                                  title={processingId === item.wardUserId ? '신청 중…' : '연결 신청'}
                                  compact
                                  onPress={() => requestCare(item)}
                                  disabled={processingId !== null}
                                />
                              </View>
                            )}
                          </Pressable>
                        );
                      }) : null}
                    </View>
                  ) : null}
                  <View style={styles.searchHintRow}>
                    <Text style={styles.searchHintIcon}>✓</Text>
                    <Text style={styles.searchHintText}>
                      이미 신청했거나 연결된 사용자는 상태로 구분해 보여드립니다.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.railGuide, stacked && styles.railGuideStacked]}>
                {[
                  ['01', '피보호자 검색', '피보호자 계정 아이디 입력'],
                  ['02', '연결 신청', '검색 결과에서 연결 요청'],
                  ['03', '승인 확인', '피보호자 승인 후 기록 확인'],
                ].map(([number, label, description]) => (
                  <View key={number} style={styles.guideRow}>
                    <Text style={styles.guideNumberText}>{number}</Text>
                    <View style={styles.guideCopy}>
                      <Text style={styles.guideTitle}>{label}</Text>
                      <Text style={styles.guideText}>{description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={[styles.statusGrid, stacked && styles.statusGridStacked]}>
              <View style={[styles.statusSummary, stacked && styles.statusSummaryStacked]}>
                <Text style={styles.statusSummaryLabel}>승인 대기</Text>
                <Text style={styles.statusSummaryValue}>{pendingSent.length}</Text>
                <Text style={styles.statusSummaryText}>피보호자의 응답을 기다리는 신청</Text>
              </View>
              <View style={styles.statusList}>
                {loading ? <LoadingState /> : careList.length ? careList.map((item) => (
                  <View key={item.careId} style={styles.requestRow}>
                    <View style={styles.timelineMark}>
                      <View style={[
                        styles.timelineDot,
                        item.careState === 'APPROVED' && styles.timelineDotSuccess,
                        item.careState === 'REJECTED' && styles.timelineDotDanger,
                      ]} />
                    </View>
                    <View style={styles.requestCopy}>
                      <Text style={styles.requestName}>{item.wardUserId}</Text>
                      <Text style={styles.requestMeta}>신청일 {formatDate(item.createdAt)}</Text>
                    </View>
                    <StatusBadge
                      label={item.careState === 'PENDING' ? '승인 대기' : item.careState === 'APPROVED' ? '연결 완료' : '거절됨'}
                      tone={item.careState === 'PENDING' ? 'warning' : item.careState === 'APPROVED' ? 'success' : 'danger'}
                    />
                  </View>
                )) : <EmptyState title="보낸 연결 신청이 없습니다.">피보호자를 검색해 첫 연결을 시작해 보세요.</EmptyState>}
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={[styles.wardLayout, stacked && styles.wardLayoutStacked]}>
          <View style={[styles.incomingSummary, stacked && styles.incomingSummaryStacked]}>
            <Text style={styles.incomingEyebrow}>PENDING REQUESTS</Text>
            <Text style={styles.incomingCount}>{pendingIncoming.length}</Text>
            <Text style={styles.incomingTitle}>승인이 필요한 연결 신청</Text>
            <Text style={styles.incomingDescription}>
              승인하면 해당 보호자가 내 진료 기록을 확인할 수 있습니다. 첫 승인 보호자는 메인 보호자로 자동 지정됩니다.
            </Text>
            <Pressable onPress={() => navigation.navigate('Settings')}>
              <Text style={styles.incomingLink}>현재 보호자 정보 보기  →</Text>
            </Pressable>
          </View>
          <View style={[styles.incomingList, stacked && styles.incomingListStacked]}>
            {loading ? <LoadingState /> : pendingIncoming.length ? pendingIncoming.map((item) => (
              <View key={item.careId} style={styles.incomingCard}>
                <View style={styles.incomingCardTop}>
                  <View style={styles.resultAvatar}>
                    <Text style={styles.resultAvatarText}>{item.guardUserId.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.requestCopy}>
                    <Text style={styles.requestName}>{item.guardUserId}</Text>
                    <Text style={styles.requestMeta}>{formatDate(item.createdAt)} 신청</Text>
                  </View>
                  <StatusBadge label="승인 대기" tone="warning" />
                </View>
                <View style={styles.incomingMessage}>
                  <Text style={styles.incomingMessageText}>
                    이 보호자를 연결하면 내 진료 기록을 함께 확인할 수 있습니다.
                  </Text>
                </View>
                <View style={styles.incomingActions}>
                  <View style={styles.actionColumn}>
                    <Button
                      title={processingId === item.careId ? '처리 중…' : '연결 승인'}
                      onPress={() => changeCare(item, true)}
                      disabled={processingId !== null}
                    />
                  </View>
                  <View style={styles.actionColumn}>
                    <Button
                      title="거절"
                      tone="secondary"
                      onPress={() => setRejectTarget(item)}
                      disabled={processingId !== null}
                    />
                  </View>
                </View>
              </View>
            )) : <EmptyState title="대기 중인 연결 신청이 없습니다.">새 신청이 들어오면 이곳에서 바로 확인할 수 있습니다.</EmptyState>}
          </View>
        </View>
      )}

      <ConfirmDialog
        visible={Boolean(rejectTarget)}
        title="연결 신청을 거절할까요?"
        description={`${rejectTarget?.guardUserId ?? '선택한 보호자'}님의 신청은 대기 목록에서 사라집니다.`}
        confirmLabel="신청 거절"
        destructive
        busy={processingId !== null}
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && changeCare(rejectTarget, false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWorkspace: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    padding: 26,
    gap: 22,
    overflow: 'hidden',
  },
  searchComposer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 24,
  },
  searchComposerStacked: { flexDirection: 'column', gap: 20 },
  searchIntro: { flex: 1, minWidth: 0, padding: 8, justifyContent: 'center' },
  searchIntroStacked: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  searchEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchEyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  searchEyebrow: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  searchTitle: { color: colors.text, fontFamily, fontSize: 26, lineHeight: 37, fontWeight: '900', letterSpacing: -0.6, marginTop: 14 },
  searchDescription: { maxWidth: 520, color: colors.textSoft, fontFamily, fontSize: 11, lineHeight: 19, marginTop: 11 },
  searchControl: {
    flex: 1.15,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 20,
    gap: 12,
  },
  searchControlStacked: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  searchControlHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  searchControlLabel: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  searchHintRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchHintIcon: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.successSoft, color: colors.success, fontFamily, fontSize: 10, fontWeight: '900', textAlign: 'center', lineHeight: 19 },
  searchHintText: { flex: 1, color: colors.muted, fontFamily, fontSize: 9, lineHeight: 15 },
  searchDropdown: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  searchDropdownHeader: { minHeight: 42, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.canvas, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  searchDropdownTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  dropdownState: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  dropdownStateIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.surfaceSoft, color: colors.primary, fontFamily, fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 30 },
  dropdownStateCopy: { flex: 1, minWidth: 0 },
  dropdownStateTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  dropdownStateText: { color: colors.muted, fontFamily, fontSize: 8, lineHeight: 14, marginTop: 3 },
  railGuide: { flexDirection: 'row', borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 8, gap: 8 },
  railGuideStacked: { flexDirection: 'column' },
  guideRow: { flex: 1, minWidth: 0, borderRadius: radius.md, backgroundColor: colors.surfaceSoft, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  guideNumberText: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  guideCopy: { flex: 1, minWidth: 0 },
  guideTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  guideText: { color: colors.muted, fontFamily, fontSize: 8, marginTop: 3 },
  resultRow: { minHeight: 76, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  resultRowStacked: { flexDirection: 'column', alignItems: 'stretch' },
  resultRowActive: { backgroundColor: colors.primarySoft },
  resultIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultAvatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  resultAvatarText: { color: colors.primary, fontFamily, fontSize: 13, fontWeight: '900' },
  resultCopy: { flex: 1, minWidth: 0 },
  resultName: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  resultId: { color: colors.muted, fontFamily, fontSize: 10, marginTop: 4 },
  resultButton: { minWidth: 95 },
  resultButtonStacked: { alignSelf: 'flex-end', minWidth: 118 },
  statusGrid: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  statusGridStacked: { flexDirection: 'column', alignItems: 'stretch' },
  statusSummary: { width: 250, borderRadius: radius.lg, backgroundColor: colors.primarySoft, padding: 25 },
  statusSummaryStacked: { width: '100%' },
  statusSummaryLabel: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900' },
  statusSummaryValue: { color: colors.text, fontFamily, fontSize: 42, fontWeight: '900', marginTop: 14 },
  statusSummaryText: { color: colors.muted, fontFamily, fontSize: 10, lineHeight: 17, marginTop: 4 },
  statusList: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  requestRow: { minHeight: 82, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelineMark: { width: 20, alignItems: 'center' },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.warning },
  timelineDotSuccess: { backgroundColor: colors.success },
  timelineDotDanger: { backgroundColor: colors.danger },
  requestCopy: { flex: 1, minWidth: 0 },
  requestName: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  requestMeta: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 5 },
  wardLayout: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  wardLayoutStacked: { flexDirection: 'column', alignItems: 'stretch' },
  incomingSummary: { width: 310, borderRadius: radius.lg, backgroundColor: colors.ink, padding: 28 },
  incomingSummaryStacked: { width: '100%' },
  incomingEyebrow: { color: '#d8f3ec', fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  incomingCount: { color: '#fff', fontFamily, fontSize: 48, fontWeight: '900', marginTop: 22 },
  incomingTitle: { color: '#fff', fontFamily, fontSize: 16, fontWeight: '900', marginTop: 6 },
  incomingDescription: { color: '#e0f0ec', fontFamily, fontSize: 10, lineHeight: 18, marginTop: 12 },
  incomingLink: { color: '#fff', fontFamily, fontSize: 10, fontWeight: '900', marginTop: 23 },
  incomingList: { flex: 1, gap: 12 },
  incomingListStacked: { width: '100%' },
  incomingCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 21, gap: 15 },
  incomingCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  incomingMessage: { borderRadius: radius.md, backgroundColor: colors.surfaceSoft, padding: 14 },
  incomingMessageText: { color: colors.textSoft, fontFamily, fontSize: 10, lineHeight: 17 },
  incomingActions: { flexDirection: 'row', gap: 9 },
  actionColumn: { flex: 1 },
});
