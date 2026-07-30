import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  InstitutionSession,
  InstitutionUser,
  InstitutionUserPage,
  InstitutionUserState,
  institutionApi,
} from '../api/institutionApi';
import { readableError } from '../api/client';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'InstitutionAdmin'>;
type Action = 'APPROVE' | 'REJECT' | 'DELETE';
type Sort = 'name-asc' | 'name-desc' | 'id-asc';

const palette = {
  primary: '#087f87',
  primaryDark: '#066b72',
  primarySoft: '#e9f6f6',
  canvas: '#f5f8f7',
  surface: '#ffffff',
  border: '#dce5e1',
  borderStrong: '#c7d2cd',
  text: '#17211d',
  secondary: '#5f6b66',
  muted: '#8a9691',
  success: '#237a57',
  successSoft: '#eaf6ef',
  warning: '#a96515',
  warningSoft: '#fff7e8',
  danger: '#b84242',
  dangerSoft: '#fff1f1',
};

const statusMeta: Record<InstitutionUserState, { label: string; empty: string }> = {
  PENDING: { label: '승인 대기', empty: '승인 대기 중인 사용자가 없습니다.' },
  APPROVED: { label: '승인', empty: '승인된 사용자가 없습니다.' },
  REJECTED: { label: '거절', empty: '거절된 사용자가 없습니다.' },
  DELETE: { label: '삭제', empty: '삭제 사용자 목록 조회 API가 제공되지 않습니다.' },
};

const actionMeta: Record<Action, { label: string; description: string }> = {
  APPROVE: { label: '승인', description: '선택한 사용자를 기관 소속 사용자로 승인합니다.' },
  REJECT: { label: '거절', description: '선택한 사용자의 기관 연결 요청을 거절합니다.' },
  DELETE: { label: '연결 해제', description: '선택한 사용자와 기관의 연결을 해제합니다.' },
};

export function InstitutionAdminScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 1040;
  const mobile = width < 700;
  const [session, setSession] = useState<InstitutionSession | null>(null);
  const [status, setStatus] = useState<InstitutionUserState>('PENDING');
  const [page, setPage] = useState(0);
  const [response, setResponse] = useState<InstitutionUserPage | null>(null);
  const [counts, setCounts] = useState<Partial<Record<InstitutionUserState, number>>>({});
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('name-asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InstitutionUser | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    const states: InstitutionUserState[] = ['PENDING', 'APPROVED', 'REJECTED'];
    const results = await Promise.allSettled(states.map((item) => institutionApi.list(item, 0, 1)));
    const next: Partial<Record<InstitutionUserState, number>> = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') next[states[index]] = result.value.totalCount;
    });
    setCounts(next);
  }, []);

  const loadList = useCallback(async () => {
    if (!session) return;
    if (status === 'DELETE') {
      setResponse(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResponse(await institutionApi.list(status, page, 10));
    } catch (caught) {
      setResponse(null);
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [page, session, status]);

  useEffect(() => {
    institutionApi.getSession().then((stored) => {
      if (!stored) {
        navigation.replace('Login');
        return;
      }
      setSession(stored);
    });
  }, [navigation]);

  useEffect(() => {
    if (!session) return;
    void loadCounts();
  }, [loadCounts, session]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const users = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('ko-KR');
    const filtered = (response?.judgeUserList || []).filter((user) => {
      if (!keyword) return true;
      return user.username.toLocaleLowerCase('ko-KR').includes(keyword)
        || user.userId.toLocaleLowerCase('ko-KR').includes(keyword);
    });
    return filtered.sort((a, b) => {
      if (sort === 'id-asc') return a.userId.localeCompare(b.userId, 'ko');
      return a.username.localeCompare(b.username, 'ko') * (sort === 'name-desc' ? -1 : 1);
    });
  }, [response, search, sort]);

  async function logout() {
    await institutionApi.logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  async function confirmAction() {
    if (!selected || !pendingAction || acting) return;
    setActing(true);
    try {
      await institutionApi.changeState(pendingAction, selected.userId);
      setNotice(`${selected.username} 사용자를 ${actionMeta[pendingAction].label} 처리했습니다.`);
      setPendingAction(null);
      setSelected(null);
      await Promise.allSettled([loadCounts(), loadList()]);
    } catch (caught) {
      setNotice(readableError(caught));
    } finally {
      setActing(false);
    }
  }

  function changeStatus(next: InstitutionUserState) {
    setStatus(next);
    setPage(0);
    setSearch('');
    setSelected(null);
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.primary} />
        <Text style={styles.loadingText}>기관 세션을 확인하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, compact && styles.pageCompact]}>
      {!compact ? (
        <View style={styles.sidebar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>H</Text></View>
            <View><Text style={styles.brandName}>HearO</Text><Text style={styles.brandCaption}>기관 관리</Text></View>
          </View>
          <View style={styles.navActive}><Text style={styles.navIcon}>◎</Text><Text style={styles.navText}>사용자 관리</Text></View>
          <View style={styles.sidebarStatus}>
            <View style={styles.onlineDot} />
            <View><Text style={styles.sidebarStatusTitle}>보안 연결됨</Text><Text style={styles.sidebarStatusText}>기관 전용 인증 세션</Text></View>
          </View>
        </View>
      ) : null}

      <View style={styles.workspace}>
        <View style={[styles.topbar, mobile && styles.topbarMobile]}>
          {compact ? (
            <View style={styles.compactBrand}>
              <View style={styles.brandMarkSmall}><Text style={styles.brandMarkSmallText}>H</Text></View>
              <Text style={styles.compactBrandText}>HearO 기관 관리</Text>
            </View>
          ) : (
            <View><Text style={styles.topbarCaption}>INSTITUTION WORKSPACE</Text><Text style={styles.topbarTitle}>기관 #{session.institutionId}</Text></View>
          )}
          <Pressable accessibilityRole="button" onPress={logout} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
            <Text style={styles.outlineButtonText}>로그아웃</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.content, mobile && styles.contentMobile]}>
          <View style={[styles.headingRow, mobile && styles.headingRowMobile]}>
            <View>
              <Text style={styles.eyebrow}>USER ADMINISTRATION</Text>
              <Text style={[styles.pageTitle, mobile && styles.pageTitleMobile]}>기관 사용자 관리</Text>
              <Text style={styles.pageDescription}>가입 요청과 연결 상태를 확인하고 필요한 조치를 처리합니다.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void Promise.allSettled([loadCounts(), loadList()])} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
              <Text style={styles.refreshButtonText}>새로고침</Text>
            </Pressable>
          </View>

          <View style={[styles.metrics, mobile && styles.metricsMobile]}>
            {(['PENDING', 'APPROVED', 'REJECTED', 'DELETE'] as InstitutionUserState[]).map((item) => (
              <View key={item} style={[styles.metric, mobile && styles.metricMobile]}>
                <View style={[styles.metricLine, item === 'REJECTED' && styles.metricLineDanger, item === 'DELETE' && styles.metricLineMuted]} />
                <Text style={styles.metricLabel}>{statusMeta[item].label}</Text>
                <Text style={styles.metricValue}>{counts[item] ?? '—'}</Text>
                <Text style={styles.metricCaption}>{item === 'DELETE' ? '조회 API 미제공' : '상태별 사용자 현황'}</Text>
              </View>
            ))}
          </View>

          <View style={styles.panel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {(['PENDING', 'APPROVED', 'REJECTED', 'DELETE'] as InstitutionUserState[]).map((item) => (
                <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: status === item }} onPress={() => changeStatus(item)} style={[styles.tab, status === item && styles.tabActive]}>
                  <Text style={[styles.tabText, status === item && styles.tabTextActive]}>{statusMeta[item].label}</Text>
                  <View style={[styles.tabCount, status === item && styles.tabCountActive]}><Text style={[styles.tabCountText, status === item && styles.tabCountTextActive]}>{counts[item] ?? '—'}</Text></View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={[styles.toolbar, mobile && styles.toolbarMobile]}>
              <TextInput accessibilityLabel="사용자 검색" value={search} onChangeText={setSearch} placeholder="이름 또는 사용자 ID 검색" placeholderTextColor={palette.muted} style={styles.searchInput} />
              <View style={styles.sortRow}>
                {([
                  ['name-asc', '이름 ↑'],
                  ['name-desc', '이름 ↓'],
                  ['id-asc', 'ID ↑'],
                ] as [Sort, string][]).map(([value, label]) => (
                  <Pressable key={value} onPress={() => setSort(value)} style={[styles.sortButton, sort === value && styles.sortButtonActive]}>
                    <Text style={[styles.sortButtonText, sort === value && styles.sortButtonTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {loading ? (
              <View style={styles.stateBox}><ActivityIndicator color={palette.primary} /><Text style={styles.stateText}>사용자 목록을 불러오고 있습니다.</Text></View>
            ) : error ? (
              <View style={styles.stateBox}><Text style={styles.errorTitle}>목록을 불러오지 못했습니다.</Text><Text style={styles.stateText}>{error}</Text></View>
            ) : status === 'DELETE' ? (
              <View style={styles.stateBox}><Text style={styles.stateTitle}>삭제 목록을 불러올 수 없습니다.</Text><Text style={styles.stateText}>{statusMeta.DELETE.empty}</Text></View>
            ) : users.length === 0 ? (
              <View style={styles.stateBox}><Text style={styles.stateTitle}>{search ? '검색 결과가 없습니다.' : statusMeta[status].empty}</Text><Text style={styles.stateText}>{search ? '이름 또는 사용자 ID를 다시 확인해 주세요.' : '새로운 상태 변경이 발생하면 이곳에 표시됩니다.'}</Text></View>
            ) : (
              <View>
                {!mobile ? (
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.userColumn]}>사용자</Text>
                    <Text style={[styles.tableHeaderText, styles.emailColumn]}>이메일</Text>
                    <Text style={[styles.tableHeaderText, styles.institutionColumn]}>담당 기관</Text>
                    <Text style={[styles.tableHeaderText, styles.stateColumn]}>상태</Text>
                    <View style={styles.actionColumn} />
                  </View>
                ) : null}
                {users.map((user) => (
                  <Pressable key={user.userId} onPress={() => setSelected(user)} style={({ pressed }) => [styles.userRow, mobile && styles.userRowMobile, pressed && styles.userRowPressed]}>
                    <View style={[styles.userIdentity, styles.userColumn]}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{user.username.slice(0, 1)}</Text></View>
                      <View style={styles.userCopy}><Text numberOfLines={1} style={styles.userName}>{user.username}</Text><Text numberOfLines={1} style={styles.userId}>{user.userId}</Text></View>
                    </View>
                    <Text numberOfLines={1} style={[styles.cellText, styles.emailColumn, mobile && styles.mobileCell]}>{user.userEmail}</Text>
                    <Text numberOfLines={1} style={[styles.cellText, styles.institutionColumn, mobile && styles.mobileCell]}>{user.institutionName}</Text>
                    <View style={[styles.stateColumn, mobile && styles.mobileState]}><StatusBadge state={user.state} /></View>
                    <View style={styles.actionColumn}><Text style={styles.detailText}>상세 보기</Text></View>
                  </Pressable>
                ))}
              </View>
            )}

            {response && users.length > 0 ? (
              <View style={[styles.pagination, mobile && styles.paginationMobile]}>
                <Text style={styles.paginationText}>전체 {response.totalCount}명 · {response.currentPage + 1}페이지</Text>
                <View style={styles.pageActions}>
                  <PageButton label="이전" disabled={response.currentPage <= 0} onPress={() => setPage((value) => Math.max(0, value - 1))} />
                  <PageButton label="다음" disabled={!response.hasNext} onPress={() => setPage((value) => value + 1)} />
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={[styles.detailModal, mobile && styles.detailModalMobile]} onPress={() => undefined}>
            {selected ? (
              <>
                <View style={styles.modalHeader}><View><Text style={styles.eyebrow}>USER DETAIL</Text><Text style={styles.modalTitle}>사용자 상세</Text></View><Pressable onPress={() => setSelected(null)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View>
                <View style={styles.detailPerson}><View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{selected.username.slice(0, 1)}</Text></View><View><Text style={styles.detailName}>{selected.username}</Text><Text style={styles.userId}>{selected.userId}</Text></View></View>
                <DetailLine label="사용자 ID" value={selected.userId} />
                <DetailLine label="이메일" value={selected.userEmail} />
                <DetailLine label="담당 기관" value={selected.institutionName} />
                <View style={styles.detailLine}><Text style={styles.detailLabel}>현재 상태</Text><StatusBadge state={selected.state} /></View>
                <View style={[styles.detailActions, mobile && styles.detailActionsMobile]}>
                  {selected.state === 'PENDING' ? <><ActionButton label="승인" onPress={() => setPendingAction('APPROVE')} /><ActionButton label="거절" danger onPress={() => setPendingAction('REJECT')} /></> : null}
                  {selected.state === 'APPROVED' ? <ActionButton label="연결 해제" danger onPress={() => setPendingAction('DELETE')} /> : null}
                  {selected.state === 'REJECTED' ? <><ActionButton label="다시 승인" onPress={() => setPendingAction('APPROVE')} /><ActionButton label="삭제 처리" danger onPress={() => setPendingAction('DELETE')} /></> : null}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(pendingAction)} transparent animationType="fade" onRequestClose={() => setPendingAction(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmMark}><Text style={styles.confirmMarkText}>!</Text></View>
            <Text style={styles.confirmTitle}>상태 변경 확인</Text>
            <Text style={styles.confirmDescription}>{pendingAction ? actionMeta[pendingAction].description : ''}</Text>
            <View style={styles.confirmSummary}><Text style={styles.confirmLabel}>대상 사용자</Text><Text style={styles.confirmValue}>{selected?.username} ({selected?.userId})</Text></View>
            <View style={styles.confirmActions}>
              <Pressable disabled={acting} onPress={() => setPendingAction(null)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>취소</Text></Pressable>
              <Pressable disabled={acting} onPress={confirmAction} style={[styles.confirmButton, pendingAction !== 'APPROVE' && styles.dangerButton]}><Text style={styles.confirmButtonText}>{acting ? '처리 중…' : pendingAction ? actionMeta[pendingAction].label : '확인'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {notice ? <Pressable onPress={() => setNotice(null)} style={styles.toast}><Text style={styles.toastText}>{notice}</Text></Pressable> : null}
    </View>
  );
}

function StatusBadge({ state }: { state: InstitutionUserState }) {
  const tone = state === 'APPROVED' ? styles.badgeApproved : state === 'PENDING' ? styles.badgePending : state === 'REJECTED' ? styles.badgeRejected : styles.badgeDeleted;
  return <View style={[styles.badge, tone]}><Text style={[styles.badgeText, state === 'APPROVED' ? styles.badgeTextApproved : state === 'PENDING' ? styles.badgeTextPending : styles.badgeTextRejected]}>{statusMeta[state].label}</Text></View>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailLine}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function ActionButton({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.actionButton, danger && styles.actionButtonDanger]}><Text style={[styles.actionButtonText, danger && styles.actionButtonDangerText]}>{label}</Text></Pressable>;
}

function PageButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.pageButton, disabled && styles.pageButtonDisabled]}><Text style={styles.pageButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { minHeight: '100%', flex: 1, flexDirection: 'row', backgroundColor: palette.canvas },
  pageCompact: { flexDirection: 'column' },
  sidebar: { width: 236, paddingHorizontal: 18, paddingVertical: 26, backgroundColor: palette.primaryDark },
  brand: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)' },
  brandMark: { width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  brandMarkText: { color: palette.primary, fontSize: 16, fontWeight: '900' },
  brandName: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
  brandCaption: { marginTop: 2, color: 'rgba(255,255,255,0.65)', fontSize: 10 },
  navActive: { minHeight: 46, marginTop: 24, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.16)' },
  navIcon: { color: '#ffffff', fontSize: 16 },
  navText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  sidebarStatus: { marginTop: 'auto', paddingHorizontal: 10, paddingTop: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  onlineDot: { width: 7, height: 7, marginTop: 4, borderRadius: 4, backgroundColor: '#70e0a6' },
  sidebarStatusTitle: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  sidebarStatusText: { marginTop: 4, color: 'rgba(255,255,255,0.58)', fontSize: 9 },
  workspace: { minWidth: 0, flex: 1 },
  topbar: { minHeight: 72, paddingHorizontal: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  topbarMobile: { minHeight: 64, paddingHorizontal: 16 },
  topbarCaption: { color: palette.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  topbarTitle: { marginTop: 4, color: palette.text, fontSize: 13, fontWeight: '800' },
  compactBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMarkSmall: { width: 30, height: 30, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  brandMarkSmallText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  compactBrandText: { color: palette.text, fontSize: 14, fontWeight: '900' },
  outlineButton: { minHeight: 38, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 6, backgroundColor: palette.surface },
  outlineButtonText: { color: palette.text, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  content: { width: '100%', maxWidth: 1480, alignSelf: 'center', paddingHorizontal: 50, paddingTop: 46, paddingBottom: 70 },
  contentMobile: { paddingHorizontal: 14, paddingTop: 30, paddingBottom: 48 },
  headingRow: { marginBottom: 32, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 },
  headingRowMobile: { alignItems: 'stretch', flexDirection: 'column' },
  eyebrow: { marginBottom: 9, color: palette.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  pageTitle: { color: palette.text, fontSize: 39, lineHeight: 48, fontWeight: '900', letterSpacing: -1.7 },
  pageTitleMobile: { fontSize: 30, lineHeight: 39 },
  pageDescription: { marginTop: 9, color: palette.secondary, fontSize: 13, lineHeight: 21 },
  refreshButton: { minHeight: 42, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 6, backgroundColor: palette.surface },
  refreshButtonText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  metrics: { marginBottom: 24, flexDirection: 'row', borderWidth: 1, borderColor: palette.border, borderRadius: 7, backgroundColor: palette.surface, overflow: 'hidden' },
  metricsMobile: { flexWrap: 'wrap' },
  metric: { minHeight: 130, paddingHorizontal: 23, paddingVertical: 22, flex: 1, borderRightWidth: 1, borderRightColor: palette.border },
  metricMobile: { minWidth: '50%', flexBasis: '50%', borderBottomWidth: 1, borderBottomColor: palette.border },
  metricLine: { height: 3, marginBottom: 18, backgroundColor: palette.primary },
  metricLineDanger: { backgroundColor: palette.danger },
  metricLineMuted: { backgroundColor: palette.muted },
  metricLabel: { color: palette.secondary, fontSize: 11, fontWeight: '800' },
  metricValue: { marginTop: 10, color: palette.text, fontSize: 28, fontWeight: '900' },
  metricCaption: { marginTop: 6, color: palette.muted, fontSize: 9 },
  panel: { borderWidth: 1, borderColor: palette.border, borderRadius: 7, backgroundColor: palette.surface, overflow: 'hidden' },
  tabs: { minHeight: 60, paddingHorizontal: 18, alignItems: 'flex-end', gap: 5, borderBottomWidth: 1, borderBottomColor: palette.border },
  tab: { minWidth: 100, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: palette.primary },
  tabText: { color: palette.secondary, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: palette.primary },
  tabCount: { minWidth: 24, minHeight: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#eef1ef' },
  tabCountActive: { backgroundColor: palette.primarySoft },
  tabCountText: { color: palette.secondary, fontSize: 9, fontWeight: '800' },
  tabCountTextActive: { color: palette.primary },
  toolbar: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: palette.border },
  toolbarMobile: { alignItems: 'stretch', flexDirection: 'column' },
  searchInput: { width: '100%', maxWidth: 430, height: 42, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 5, backgroundColor: '#ffffff', color: palette.text, fontSize: 12 },
  sortRow: { flexDirection: 'row', gap: 6 },
  sortButton: { minHeight: 34, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 5, backgroundColor: palette.surface },
  sortButtonActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  sortButtonText: { color: palette.secondary, fontSize: 9, fontWeight: '800' },
  sortButtonTextActive: { color: palette.primary },
  stateBox: { minHeight: 270, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: palette.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  errorTitle: { color: palette.danger, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  stateText: { maxWidth: 480, marginTop: 9, color: palette.secondary, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  loadingText: { marginTop: 11, color: palette.secondary, fontSize: 11 },
  tableHeader: { minHeight: 42, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafbfa' },
  tableHeaderText: { color: palette.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  userRow: { minHeight: 74, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.border },
  userRowMobile: { paddingVertical: 16, alignItems: 'flex-start', flexDirection: 'column', gap: 6 },
  userRowPressed: { backgroundColor: '#f8fbfa' },
  userColumn: { minWidth: 0, flex: 2.2 },
  emailColumn: { minWidth: 0, flex: 2.2 },
  institutionColumn: { minWidth: 0, flex: 1.6 },
  stateColumn: { minWidth: 90, flex: 1 },
  actionColumn: { width: 72, alignItems: 'flex-end' },
  userIdentity: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 35, height: 35, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbe1de', borderRadius: 5, backgroundColor: palette.primarySoft },
  avatarText: { color: palette.primary, fontSize: 12, fontWeight: '900' },
  userCopy: { minWidth: 0, flex: 1 },
  userName: { color: palette.text, fontSize: 12, fontWeight: '900' },
  userId: { marginTop: 3, color: palette.muted, fontSize: 10 },
  cellText: { paddingRight: 12, color: palette.secondary, fontSize: 11 },
  mobileCell: { width: '100%', paddingLeft: 46, paddingRight: 0, flex: 0 },
  mobileState: { position: 'absolute', top: 16, right: 16, minWidth: 0, flex: 0 },
  detailText: { color: palette.primary, fontSize: 10, fontWeight: '900' },
  badge: { minHeight: 25, paddingHorizontal: 9, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 13 },
  badgeApproved: { borderColor: '#c7e3d3', backgroundColor: palette.successSoft },
  badgePending: { borderColor: '#efdcb8', backgroundColor: palette.warningSoft },
  badgeRejected: { borderColor: '#edcaca', backgroundColor: palette.dangerSoft },
  badgeDeleted: { borderColor: palette.border, backgroundColor: '#eef1ef' },
  badgeText: { fontSize: 9, fontWeight: '900' },
  badgeTextApproved: { color: palette.success },
  badgeTextPending: { color: palette.warning },
  badgeTextRejected: { color: palette.danger },
  pagination: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.border },
  paginationMobile: { paddingVertical: 14, alignItems: 'stretch', flexDirection: 'column', gap: 11 },
  paginationText: { color: palette.secondary, fontSize: 10 },
  pageActions: { flexDirection: 'row', gap: 7 },
  pageButton: { minWidth: 62, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 5, backgroundColor: palette.surface },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { color: palette.text, fontSize: 10, fontWeight: '800' },
  centered: { minHeight: '100%', flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
  modalBackdrop: { minHeight: '100%', flex: 1, alignItems: 'flex-end', backgroundColor: 'rgba(23,33,29,0.42)' },
  detailModal: { width: '100%', maxWidth: 480, minHeight: '100%', padding: 28, backgroundColor: palette.surface },
  detailModalMobile: { maxWidth: '100%', padding: 20 },
  modalHeader: { paddingBottom: 21, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.border },
  modalTitle: { color: palette.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 6 },
  closeText: { color: palette.secondary, fontSize: 24, lineHeight: 27 },
  detailPerson: { paddingVertical: 24, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatarLarge: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbe1de', borderRadius: 6, backgroundColor: palette.primarySoft },
  avatarLargeText: { color: palette.primary, fontSize: 16, fontWeight: '900' },
  detailName: { color: palette.text, fontSize: 18, fontWeight: '900' },
  detailLine: { minHeight: 52, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: 1, borderTopColor: palette.border },
  detailLabel: { width: 90, color: palette.muted, fontSize: 10, fontWeight: '800' },
  detailValue: { minWidth: 0, flex: 1, color: palette.text, fontSize: 12, fontWeight: '700' },
  detailActions: { marginTop: 26, paddingTop: 20, flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: palette.border },
  detailActionsMobile: { flexDirection: 'column' },
  actionButton: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: palette.primary },
  actionButtonDanger: { borderWidth: 1, borderColor: '#e8caca', backgroundColor: palette.dangerSoft },
  actionButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  actionButtonDangerText: { color: palette.danger },
  confirmBackdrop: { minHeight: '100%', flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(23,33,29,0.58)' },
  confirmModal: { width: '100%', maxWidth: 430, padding: 28, borderRadius: 7, backgroundColor: palette.surface },
  confirmMark: { width: 38, height: 38, marginBottom: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#efd0d0', borderRadius: 6, backgroundColor: palette.dangerSoft },
  confirmMarkText: { color: palette.danger, fontSize: 16, fontWeight: '900' },
  confirmTitle: { color: palette.text, fontSize: 21, fontWeight: '900' },
  confirmDescription: { marginTop: 9, color: palette.secondary, fontSize: 12, lineHeight: 19 },
  confirmSummary: { marginTop: 18, padding: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 16, backgroundColor: palette.canvas },
  confirmLabel: { color: palette.muted, fontSize: 10 },
  confirmValue: { flex: 1, color: palette.text, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  confirmActions: { marginTop: 22, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelButton: { minHeight: 42, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 6 },
  cancelButtonText: { color: palette.text, fontSize: 11, fontWeight: '800' },
  confirmButton: { minHeight: 42, minWidth: 84, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: palette.primary },
  dangerButton: { backgroundColor: palette.danger },
  confirmButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  toast: { position: 'absolute', right: 22, bottom: 22, maxWidth: 390, paddingHorizontal: 17, paddingVertical: 14, borderLeftWidth: 4, borderLeftColor: '#6fd1b0', backgroundColor: palette.primaryDark },
  toastText: { color: '#ffffff', fontSize: 11, lineHeight: 17, fontWeight: '700' },
});
