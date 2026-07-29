import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
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
  Field,
  Notice,
  PageHeader,
  Screen,
  StatusBadge,
} from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius } from '../theme/theme';
import { Institution, MedicalRequest } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'InstitutionSearch'>;

export function InstitutionSearchScreen({ navigation }: Props) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const stacked = width < 1000;
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Institution[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Institution | null>(null);
  const searchSequence = useRef(0);

  useEffect(() => {
    if (session?.userType !== 'WARD') return;
    teamApi.getWardRequests().then(setRequests).catch(() => undefined);
  }, [session?.userType]);

  useEffect(() => {
    if (session?.userType !== 'WARD') return;
    const query = keyword.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }

    const sequence = ++searchSequence.current;
    const timer = setTimeout(async () => {
      setLoading(true);
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
        if (sequence === searchSequence.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, session?.userType]);

  async function requestTreatment(institution: Institution) {
    if (requestingId) return;
    setRequestingId(institution.institutionUserId);
    setError(null);
    try {
      const next = await teamApi.createMedicalRequest(institution.institutionUserId);
      setRequests((current) => [next, ...current]);
      setSuccess(institution);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setRequestingId(null);
    }
  }

  function handleKey(key: string) {
    if (!results.length) return;
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

  return (
    <Screen>
      <PageHeader
        eyebrow="NEW TREATMENT REQUEST"
        title="진료를 요청할 기관을 찾아보세요."
        description="기관명이나 담당자 아이디를 입력하면 실제 등록된 기관 사용자만 검색합니다."
        actions={
          <Button
            title="내 요청 현황"
            tone="secondary"
            compact
            onPress={() => navigation.navigate('RequestList')}
          />
        }
      />

      {error ? <Notice tone="error" title="요청을 처리하지 못했습니다.">{error}</Notice> : null}
      {success ? (
        <Notice tone="success" title={`${success.name}에 진료를 요청했습니다.`}>
          기관이 수락하면 요청 현황에서 진료 시작 버튼을 확인할 수 있습니다.
        </Notice>
      ) : null}

      <View style={styles.layout}>
        <View style={[styles.searchStage, stacked && styles.searchStageStacked]}>
          <View style={[styles.searchNarrative, stacked && styles.searchNarrativeStacked]}>
            <View style={styles.railEyebrowRow}>
              <View style={styles.railEyebrowDot} />
              <Text style={styles.railEyebrow}>STEP 01 · 기관 선택</Text>
            </View>
            <Text style={styles.railTitle}>어디에서 진료받을지{'\n'}검색으로 시작하세요.</Text>
            <Text style={styles.railDescription}>
              기관 이름 또는 담당자 아이디를 입력하고, 검색 결과에서 요청할 대상을 정확히 확인해 주세요.
            </Text>
          </View>

          <View style={[styles.searchBox, stacked && styles.searchBoxStacked]}>
            <View style={styles.searchBoxHeader}>
              <Text style={styles.searchBoxTitle}>기관·담당자 검색</Text>
              <StatusBadge label="자동 검색" tone="primary" />
            </View>
            <Field
              label="검색어"
              value={keyword}
              onChangeText={(value) => {
                setKeyword(value);
                setSuccess(null);
              }}
              onKeyPress={(event) => handleKey(event.nativeEvent.key)}
              placeholder="기관명 또는 담당자 아이디"
              hint="입력을 멈추면 바로 검색합니다."
            />
            {keyword.trim() ? (
              <View accessibilityRole="menu" style={styles.searchDropdown}>
                <View style={styles.searchDropdownHeader}>
                  <Text style={styles.searchDropdownTitle}>검색된 기관 사용자</Text>
                  <StatusBadge label={`${results.length}명`} tone="primary" />
                </View>
                {loading ? (
                  <View style={styles.dropdownState}>
                    <Text style={styles.dropdownStateIcon}>…</Text>
                    <View style={styles.dropdownStateCopy}>
                      <Text style={styles.dropdownStateTitle}>기관 사용자를 검색하고 있습니다.</Text>
                      <Text style={styles.dropdownStateText}>잠시만 기다려 주세요.</Text>
                    </View>
                  </View>
                ) : null}
                {!loading && !results.length ? (
                  <View style={styles.dropdownState}>
                    <Text style={styles.dropdownStateIcon}>?</Text>
                    <View style={styles.dropdownStateCopy}>
                      <Text style={styles.dropdownStateTitle}>검색 결과가 없습니다.</Text>
                      <Text style={styles.dropdownStateText}>기관명이나 담당자 아이디를 다시 확인해 주세요.</Text>
                    </View>
                  </View>
                ) : null}
                {!loading && results.length ? results.map((item, index) => {
                  const existing = requests.find(
                    (request) =>
                      request.institutionUserId === item.institutionUserId &&
                      ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(request.status),
                  );
                  return (
                    <Pressable
                      key={item.institutionUserId}
                      accessibilityRole="menuitem"
                      onPress={() => !existing && requestTreatment(item)}
                      style={[
                        styles.institutionRow,
                        stacked && styles.institutionRowStacked,
                        index === activeIndex && styles.institutionRowActive,
                      ]}
                    >
                      <View style={styles.institutionIdentity}>
                        <View style={styles.institutionMark}>
                          <Text style={styles.institutionMarkText}>H</Text>
                        </View>
                        <View style={styles.institutionCopy}>
                          <Text style={styles.institutionName}>{item.name}</Text>
                          <Text style={styles.institutionMeta}>
                            담당자 {item.institutionUserId} · {item.email}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.institutionAction, stacked && styles.institutionActionStacked]}>
                        <View style={styles.availability}>
                          <View style={styles.availabilityDot} />
                          <Text style={styles.availabilityText}>
                            {existing ? '처리 중인 요청 있음' : '진료 요청 가능'}
                          </Text>
                        </View>
                        <View style={[styles.requestButton, stacked && styles.requestButtonStacked]}>
                          <Button
                            title={
                              existing
                                ? '요청 현황 보기'
                                : requestingId === item.institutionUserId
                                  ? '요청 중…'
                                  : '진료 요청'
                            }
                            tone={existing ? 'secondary' : 'primary'}
                            compact
                            onPress={() =>
                              existing
                                ? navigation.navigate('RequestList')
                                : requestTreatment(item)
                            }
                            disabled={requestingId !== null}
                          />
                        </View>
                      </View>
                    </Pressable>
                  );
                }) : null}
              </View>
            ) : null}
            <View style={styles.searchBoxHint}>
              <Text style={styles.searchBoxHintIcon}>✓</Text>
              <Text style={styles.searchBoxHintText}>등록된 기관 사용자만 검색 결과에 표시됩니다.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.railGuide, stacked && styles.railGuideStacked]}>
            {[
              ['01', '기관 검색', '기관명이나 담당자 아이디 입력'],
              ['02', '요청 보내기', '검색 결과에서 진료 요청'],
              ['03', '진료 시작', '기관 수락 후 대화 시작'],
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

      <View style={[styles.bottomGuide, stacked && styles.bottomGuideStacked]}>
        <View>
          <Text style={styles.bottomGuideTitle}>요청을 보낸 다음에는</Text>
          <Text style={styles.bottomGuideText}>
            기관의 응답 상태를 확인하고, 수락된 요청에서만 진료를 시작할 수 있습니다.
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('RequestList')}>
          <Text style={styles.bottomGuideLink}>진료 요청 흐름 확인  →</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    padding: 26,
    gap: 22,
    overflow: 'hidden',
  },
  searchStage: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 24,
  },
  searchStageStacked: { flexDirection: 'column', gap: 20 },
  searchNarrative: { flex: 1, minWidth: 0, padding: 8, justifyContent: 'center' },
  searchNarrativeStacked: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  railEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  railEyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  railEyebrow: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  railTitle: { color: colors.text, fontFamily, fontSize: 26, lineHeight: 37, fontWeight: '900', letterSpacing: -0.6, marginTop: 14 },
  railDescription: { maxWidth: 520, color: colors.textSoft, fontFamily, fontSize: 11, lineHeight: 19, marginTop: 11 },
  searchBox: {
    flex: 1.15,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 20,
    gap: 12,
  },
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
  railGuide: { flexDirection: 'row', borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 8, gap: 8 },
  railGuideStacked: { flexDirection: 'column' },
  guideRow: { flex: 1, minWidth: 0, borderRadius: radius.md, backgroundColor: colors.surfaceSoft, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  guideNumberText: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  guideCopy: { flex: 1, minWidth: 0 },
  guideTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  guideText: { color: colors.muted, fontFamily, fontSize: 8, marginTop: 3 },
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
  bottomGuide: { borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
  bottomGuideStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  bottomGuideTitle: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  bottomGuideText: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 4 },
  bottomGuideLink: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
});
