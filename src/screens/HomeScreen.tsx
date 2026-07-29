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
  Screen,
  StatusBadge,
  formatDate,
  roleLabel,
} from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import {
  ArchiveList,
  CareListItem,
  ConnectedGuardian,
  ConnectedWard,
  MedicalRequest,
  MyPage,
} from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const requestLabels = {
  REQUESTED: '응답 대기',
  ACCEPTED: '진료 시작 가능',
  REJECTED: '요청 거절',
  IN_PROGRESS: '진료 중',
  COMPLETED: '진료 완료',
  CANCELED: '요청 취소',
} as const;

export function HomeScreen({ navigation }: Props) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const stacked = width < 1180;
  const mobile = width < 760;
  const [profile, setProfile] = useState<MyPage | null>(null);
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [careItems, setCareItems] = useState<CareListItem[]>([]);
  const [guardians, setGuardians] = useState<ConnectedGuardian[]>([]);
  const [wards, setWards] = useState<ConnectedWard[]>([]);
  const [archives, setArchives] = useState<ArchiveList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const failures: string[] = [];

    const profileResult = await Promise.allSettled([teamApi.getMyPage(session.userType)]);
    if (profileResult[0].status === 'fulfilled') setProfile(profileResult[0].value);
    else failures.push(readableError(profileResult[0].reason));

    if (session.userType === 'WARD') {
      const results = await Promise.allSettled([
        teamApi.getWardRequests(),
        teamApi.getArchives(),
        teamApi.getConnectedGuardians(),
      ]);
      if (results[0].status === 'fulfilled') setRequests(results[0].value ?? []);
      else failures.push(readableError(results[0].reason));
      if (results[1].status === 'fulfilled') setArchives(results[1].value);
      else failures.push(readableError(results[1].reason));
      if (results[2].status === 'fulfilled') setGuardians(results[2].value.guardSearchList ?? []);
      else failures.push(readableError(results[2].reason));
    } else if (session.userType === 'INSTITUTIONS') {
      const result = await Promise.allSettled([teamApi.getInstitutionRequests()]);
      if (result[0].status === 'fulfilled') setRequests(result[0].value ?? []);
      else failures.push(readableError(result[0].reason));
    } else {
      const results = await Promise.allSettled([
        teamApi.getGuardianCareList(),
        teamApi.getConnectedWards(),
      ]);
      if (results[0].status === 'fulfilled') setCareItems(results[0].value.careList ?? []);
      else failures.push(readableError(results[0].reason));
      if (results[1].status === 'fulfilled') setWards(results[1].value.wardSearchList ?? []);
      else failures.push(readableError(results[1].reason));
    }

    setError(failures.length ? Array.from(new Set(failures)).join(' · ') : null);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!session) return null;
  const isWard = session.userType === 'WARD';
  const isGuardian = session.userType === 'GUARDIAN';
  const latestRequest = requests[0];
  const today = new Date();
  const displayName = profile?.username || session.userId;

  const primaryRoute = isWard ? 'InstitutionSearch' : isGuardian ? 'Care' : 'RequestList';
  const primaryLabel = isWard ? '진료 요청하기' : isGuardian ? '연결 관리하기' : '요청 확인하기';

  const metrics = isWard
    ? [
        ['진행 중 요청', requests.filter((item) => ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(item.status)).length, '건'],
        ['완료된 기록', archives?.totalCount ?? 0, '건'],
        ['연결 보호자', guardians.length, '명'],
      ]
    : isGuardian
      ? [
          ['연결된 피보호자', wards.length, '명'],
          ['대기 중 연결', careItems.filter((item) => item.careState === 'PENDING').length, '건'],
          ['완료된 연결', careItems.filter((item) => item.careState === 'APPROVED').length, '건'],
        ]
      : [
          ['새 진료 요청', requests.filter((item) => item.status === 'REQUESTED').length, '건'],
          ['수락한 요청', requests.filter((item) => item.status === 'ACCEPTED').length, '건'],
          ['진료 진행 중', requests.filter((item) => item.status === 'IN_PROGRESS').length, '건'],
        ];

  return (
    <Screen>
      <View style={[styles.welcome, mobile && styles.welcomeMobile]}>
        <View style={styles.welcomeCopy}>
          <Text style={styles.dateLabel}>
            {today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
          <Text style={[styles.welcomeTitle, mobile && styles.welcomeTitleMobile]}>
            {displayName}님,{'\n'}
            {isWard
              ? '오늘의 진료를 차분히 준비해 볼까요?'
              : isGuardian
                ? '가족의 연결과 기록을 확인해 보세요.'
                : '도착한 진료 요청을 확인해 주세요.'}
          </Text>
          <Text style={styles.welcomeDescription}>
            {roleLabel(session.userType)} 계정에 필요한 정보와 다음 행동만 모았습니다.
          </Text>
        </View>
        <View style={[styles.welcomeAction, mobile && styles.welcomeActionMobile]}>
          <Button title={`${primaryLabel}  →`} onPress={() => navigation.navigate(primaryRoute as never)} />
        </View>
      </View>

      {error ? (
        <Notice tone="error" title="일부 정보를 불러오지 못했습니다.">{error}</Notice>
      ) : null}

      <View style={styles.metricGrid}>
        {metrics.map(([label, value, unit]) => (
          <View key={label as string} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{label}</Text>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.metricUnit}>{unit}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.dashboard, stacked && styles.dashboardStacked]}>
        <View style={styles.mainColumn}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>
                {isGuardian ? 'CARE CONNECTION' : isWard ? 'RECENT RECORDS' : 'RECENT ACTIVITY'}
              </Text>
              <Text style={styles.sectionTitle}>
                {isGuardian ? '케어 연결 현황' : isWard ? '최근 진료 기록' : '도착한 진료 요청'}
              </Text>
            </View>
            <Pressable onPress={() => navigation.navigate((isGuardian ? 'Care' : isWard ? 'ArchiveList' : 'RequestList') as never)}>
              <Text style={styles.sectionLink}>전체 보기  →</Text>
            </Pressable>
          </View>

          <View style={styles.activityPanel}>
            {loading ? <LoadingState /> : isGuardian ? (
              careItems.length ? careItems.slice(0, 5).map((item) => (
                <Pressable key={item.careId} onPress={() => navigation.navigate('Care')} style={styles.activityRow}>
                  <View style={styles.personMark}><Text style={styles.personMarkText}>{item.wardUserId.slice(0, 1).toUpperCase()}</Text></View>
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityTitle}>{item.wardUserId}</Text>
                    <Text style={styles.activityMeta}>연결 신청 · {formatDate(item.createdAt)}</Text>
                  </View>
                  <StatusBadge
                    label={item.careState === 'PENDING' ? '승인 대기' : item.careState === 'APPROVED' ? '연결됨' : '거절됨'}
                    tone={item.careState === 'PENDING' ? 'warning' : item.careState === 'APPROVED' ? 'success' : 'danger'}
                  />
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              )) : <EmptyState title="아직 케어 연결이 없습니다.">피보호자를 찾아 연결을 신청해 보세요.</EmptyState>
            ) : isWard ? (
              archives?.list.length ? archives.list.slice(0, 5).map((archive) => (
                <Pressable
                  key={archive.archiveId}
                  onPress={() => navigation.navigate('ArchiveDetail', { archiveId: archive.archiveId })}
                  style={styles.activityRow}
                >
                  <View style={styles.requestDate}>
                    <Text style={styles.requestDay}>{new Date(archive.archiveDate).getDate()}</Text>
                    <Text style={styles.requestMonth}>{new Date(archive.archiveDate).getMonth() + 1}월</Text>
                  </View>
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityTitle}>
                      {archive.archiveName || `진료 기록 #${archive.archiveId}`}
                    </Text>
                    <Text style={styles.activityMeta}>
                      저장된 진료 요약 · {formatDate(archive.archiveDate)}
                    </Text>
                  </View>
                  <StatusBadge label="진료 완료" tone="success" />
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              )) : <EmptyState title="완료된 진료 기록이 없습니다.">진료가 종료되고 기록이 생성되면 여기에 표시됩니다.</EmptyState>
            ) : requests.length ? requests.slice(0, 5).map((request) => (
              <Pressable key={request.medicalRequestId} onPress={() => navigation.navigate('RequestList')} style={styles.activityRow}>
                <View style={styles.requestDate}>
                  <Text style={styles.requestDay}>{new Date(request.createdAt).getDate()}</Text>
                  <Text style={styles.requestMonth}>{new Date(request.createdAt).getMonth() + 1}월</Text>
                </View>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityTitle}>
                    {isWard ? request.institutionUserName : request.wardUserName}
                  </Text>
                  <Text style={styles.activityMeta}>
                    {isWard ? `기관 ${request.institutionUserId}` : `피보호자 ${request.wardUserId}`}
                    {' · '}
                    {formatDate(request.createdAt)}
                  </Text>
                </View>
                <StatusBadge
                  label={requestLabels[request.status]}
                  tone={request.status === 'REQUESTED' ? 'warning' : request.status === 'REJECTED' ? 'danger' : request.status === 'COMPLETED' ? 'success' : 'primary'}
                />
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )) : <EmptyState title="표시할 진료 요청이 없습니다.">새로운 요청이 도착하거나 요청을 보내면 여기에 표시됩니다.</EmptyState>}
          </View>

          <View style={styles.quickHeading}>
            <Text style={styles.sectionTitle}>바로가기</Text>
          </View>
          <View style={styles.quickGrid}>
            {quickActions(session.userType).map((item) => (
              <Pressable
                key={item.route}
                onPress={() => navigation.navigate(item.route as never)}
                style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
              >
                <View style={styles.quickCardIcon}><Text style={styles.quickCardIconText}>{item.icon}</Text></View>
                <Text style={styles.quickCardTitle}>{item.title}</Text>
                <Text style={styles.quickCardText}>{item.copy}</Text>
                <Text style={styles.quickCardLink}>이동하기  →</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.sideRail, stacked && styles.sideRailStacked]}>
          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>HearO 이용 도움말</Text>
            {helpItems(session.userType).map(([icon, label]) => (
              <View key={label} style={styles.guideRow}>
                <Text style={styles.guideIcon}>{icon}</Text>
                <Text style={styles.guideText}>{label}</Text>
              </View>
            ))}
            <Pressable onPress={() => navigation.navigate('Inquiry')}>
              <Text style={styles.guideLink}>문의 등록 및 답변 확인  →</Text>
            </Pressable>
          </View>
          <View style={styles.nextCard}>
            <Text style={styles.nextEyebrow}>NEXT ACTION</Text>
            <Text style={styles.nextTitle}>
              {nextActionTitle(session.userType, latestRequest, requests, careItems)}
            </Text>
            <Text style={styles.nextText}>
              {nextActionCopy(session.userType, latestRequest, requests, careItems)}
            </Text>
            <Pressable onPress={() => navigation.navigate(primaryRoute as never)}>
              <Text style={styles.nextLink}>{primaryLabel}  →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function quickActions(type: 'WARD' | 'GUARDIAN' | 'INSTITUTIONS') {
  if (type === 'WARD') return [
    { route: 'InstitutionSearch', icon: '＋', title: '진료 요청', copy: '기관 사용자를 검색하고 요청을 보냅니다.' },
    { route: 'ArchiveList', icon: '▤', title: '진료 기록', copy: '완료된 진료의 대화와 요약을 확인합니다.' },
    { route: 'Care', icon: '♡', title: '보호자 연결', copy: '받은 연결 신청과 메인 보호자를 관리합니다.' },
  ];
  if (type === 'GUARDIAN') return [
    { route: 'Care', icon: '♡', title: '피보호자 연결', copy: '아이디로 검색해 새로운 연결을 신청합니다.' },
    { route: 'ArchiveList', icon: '▤', title: '가족 기록', copy: '연결된 피보호자를 선택해 기록을 확인합니다.' },
    { route: 'Settings', icon: '◎', title: '연결 정보', copy: '내 계정과 연결된 가족 정보를 관리합니다.' },
  ];
  return [
    { route: 'RequestList', icon: '＋', title: '진료 요청', copy: '도착한 요청을 검토하고 수락 또는 거절합니다.' },
    { route: 'Settings', icon: '◎', title: '기관 정보', copy: '소속 기관과 담당자 계정 정보를 확인합니다.' },
    { route: 'Inquiry', icon: '?', title: '문의하기', copy: '서비스 이용 문의와 답변을 확인합니다.' },
  ];
}

function helpItems(type: 'WARD' | 'GUARDIAN' | 'INSTITUTIONS') {
  if (type === 'INSTITUTIONS') return [
    ['✓', '기관 계정 권한으로 요청 조회'],
    ['◉', '진료 음성 녹음과 텍스트 변환'],
    ['＋', '요청 수락·거절 상태 관리'],
  ];
  if (type === 'GUARDIAN') return [
    ['✓', '역할별 권한으로 안전하게 조회'],
    ['♡', '피보호자 연결 상태 관리'],
    ['▤', '연결된 가족의 진료 기록 확인'],
  ];
  return [
    ['✓', '역할별 권한으로 안전하게 조회'],
    ['♡', '보호자 연결과 메인 보호자 관리'],
    ['▤', '진료 대화와 요약 다시 확인'],
  ];
}

function nextActionTitle(
  type: 'WARD' | 'GUARDIAN' | 'INSTITUTIONS',
  latest: MedicalRequest | undefined,
  requests: MedicalRequest[],
  careItems: CareListItem[],
) {
  if (type === 'INSTITUTIONS') {
    const pending = requests.filter((item) => item.status === 'REQUESTED').length;
    return pending ? `응답이 필요한 요청이 ${pending}건 있어요.` : '새로운 요청을 기다리고 있어요.';
  }
  if (type === 'GUARDIAN') {
    const pending = careItems.filter((item) => item.careState === 'PENDING').length;
    return pending ? `${pending}건의 연결 승인을 기다리고 있어요.` : '가족 연결 상태를 확인해 보세요.';
  }
  if (!latest) return '먼저 진료 기관을 찾아보세요.';
  return latest.status === 'ACCEPTED'
    ? '수락된 요청의 진료를 시작할 수 있어요.'
    : latest.status === 'REQUESTED'
      ? '기관의 응답을 기다리고 있어요.'
      : latest.status === 'IN_PROGRESS'
        ? '진료 대화가 진행 중이에요.'
        : '새로운 진료를 준비해 보세요.';
}

function nextActionCopy(
  type: 'WARD' | 'GUARDIAN' | 'INSTITUTIONS',
  latest: MedicalRequest | undefined,
  requests: MedicalRequest[],
  careItems: CareListItem[],
) {
  if (type === 'INSTITUTIONS') return requests.some((item) => item.status === 'REQUESTED')
    ? '요청한 피보호자와 시간을 확인한 뒤 응답해 주세요.'
    : '새 요청이 도착하면 요청 센터에서 바로 확인할 수 있습니다.';
  if (type === 'GUARDIAN') return careItems.some((item) => item.careState === 'PENDING')
    ? '피보호자가 승인하면 진료 기록 조회가 가능해집니다.'
    : '피보호자 아이디를 알고 있다면 새로운 연결을 신청할 수 있습니다.';
  if (latest?.status === 'ACCEPTED') return '진료 시작 버튼을 누르면 대화방과 기록 공간이 생성됩니다.';
  if (latest?.status === 'REQUESTED') return '기관이 수락하거나 거절하면 요청 현황이 갱신됩니다.';
  return '증상을 정리한 뒤 적합한 기관 사용자에게 요청해 보세요.';
}

const styles = StyleSheet.create({
  welcome: {
    minHeight: 148,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 25,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 20,
  },
  welcomeMobile: {
    minHeight: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingBottom: 20,
  },
  welcomeCopy: { flex: 1 },
  dateLabel: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  welcomeTitle: { color: colors.text, fontFamily, fontSize: 31, lineHeight: 42, fontWeight: '900', letterSpacing: -0.9, marginTop: 9 },
  welcomeTitleMobile: { fontSize: 27, lineHeight: 37, letterSpacing: -0.6 },
  welcomeDescription: { color: colors.muted, fontFamily, fontSize: 12, marginTop: 7 },
  welcomeAction: { minWidth: 160 },
  welcomeActionMobile: { minWidth: 0, alignSelf: 'flex-start' },
  metricGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { minWidth: 190, flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 19 },
  metricLabel: { color: colors.muted, fontFamily, fontSize: 10, fontWeight: '800' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 9 },
  metricValue: { color: colors.text, fontFamily, fontSize: 28, fontWeight: '900' },
  metricUnit: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  dashboard: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 24, marginTop: 6 },
  dashboardStacked: { flexDirection: 'column' },
  mainColumn: { flex: 1, minWidth: 0 },
  sideRail: { width: 330, gap: 15 },
  sideRailStacked: { width: '100%', flexDirection: 'row', flexWrap: 'wrap' },
  sectionHeading: { minHeight: 56, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 15, marginBottom: 12 },
  sectionEyebrow: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.text, fontFamily, fontSize: 19, fontWeight: '900', marginTop: 5 },
  sectionLink: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  activityPanel: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  activityRow: { minHeight: 82, paddingHorizontal: 17, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 13 },
  personMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  personMarkText: { color: colors.primary, fontFamily, fontSize: 13, fontWeight: '900' },
  requestDate: { width: 42, alignItems: 'center' },
  requestDay: { color: colors.text, fontFamily, fontSize: 18, fontWeight: '900' },
  requestMonth: { color: colors.muted, fontFamily, fontSize: 8, marginTop: -1 },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  activityMeta: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 5 },
  chevron: { color: colors.faint, fontFamily, fontSize: 23 },
  quickHeading: { marginTop: 29, marginBottom: 12 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: { minWidth: 210, flex: 1, minHeight: 190, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 19 },
  quickCardPressed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  quickCardIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickCardIconText: { color: colors.primary, fontFamily, fontSize: 16, fontWeight: '900' },
  quickCardTitle: { color: colors.text, fontFamily, fontSize: 14, fontWeight: '900', marginTop: 17 },
  quickCardText: { color: colors.muted, fontFamily, fontSize: 10, lineHeight: 17, marginTop: 6 },
  quickCardLink: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', marginTop: 'auto' },
  nextCard: { flex: 1, minWidth: 300, borderRadius: radius.md, backgroundColor: colors.ink, padding: 21 },
  nextEyebrow: { color: '#d8f3ec', fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  nextTitle: { color: '#fff', fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '900', marginTop: 10 },
  nextText: { color: '#e0f0ec', fontFamily, fontSize: 10, lineHeight: 17, marginTop: 7 },
  nextLink: { color: '#fff', fontFamily, fontSize: 10, fontWeight: '900', marginTop: 18 },
  guideCard: { flex: 1, minWidth: 300, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 20 },
  guideTitle: { color: colors.text, fontFamily, fontSize: 14, fontWeight: '900', marginBottom: 12 },
  guideRow: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 9 },
  guideIcon: { width: 20, color: colors.primary, fontFamily, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  guideText: { color: colors.textSoft, fontFamily, fontSize: 10 },
  guideLink: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', marginTop: 14 },
});
