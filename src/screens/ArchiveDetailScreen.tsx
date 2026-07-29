import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
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
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius } from '../theme/theme';
import { ArchiveDetail } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchiveDetail'>;

export function ArchiveDetailScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const wide = width >= 1320;
  const [archive, setArchive] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    teamApi.getArchive(route.params.archiveId)
      .then(setArchive)
      .catch((caught) => setError(readableError(caught)))
      .finally(() => setLoading(false));
  }, [route.params.archiveId]);

  const transcript = useMemo(
    () => parseTranscript(archive?.allChatText ?? ''),
    [archive?.allChatText],
  );
  const summary = useMemo(
    () => buildArchiveSummary(archive),
    [archive],
  );

  async function copyTranscript() {
    if (!archive?.allChatText) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(archive.allChatText);
        setNotice('전체 대화를 클립보드에 복사했습니다.');
      } else {
        setNotice('현재 환경에서는 클립보드 복사를 지원하지 않습니다.');
      }
    } catch {
      setNotice('클립보드에 복사하지 못했습니다.');
    }
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="ARCHIVE DETAIL"
        title={archive?.title || (loading ? '진료 기록을 불러오는 중입니다.' : `진료 기록 #${route.params.archiveId}`)}
        description={
          archive
            ? `${formatDate(archive.archiveDate)} · 아카이브 #${archive.archiveId}`
            : '저장된 진료 요약과 전체 대화를 확인합니다.'
        }
        actions={
          <View style={styles.headerActions}>
            <Button title="목록으로" tone="secondary" compact onPress={() => navigation.navigate('ArchiveList')} />
            <Button title="대화 복사" compact onPress={copyTranscript} disabled={!archive?.allChatText} />
          </View>
        }
      />

      {error ? <Notice tone="error" title="진료 기록을 불러오지 못했습니다.">{error}</Notice> : null}
      {notice ? <Notice>{notice}</Notice> : null}
      {loading ? <LoadingState label="진료 기록의 세부 내용을 불러오고 있습니다." /> : null}

      {archive ? (
        <View style={styles.content}>
          <View style={styles.summarySection}>
            <View style={[styles.summaryLead, compact && styles.summaryLeadCompact]}>
              <View style={styles.summaryLeadCopy}>
                <Text style={styles.summaryEyebrow}>AI SUMMARY</Text>
                <Text style={[styles.summaryHeading, compact && styles.summaryHeadingCompact]}>
                  한눈에 보는 진료 요약
                </Text>
                <Text style={styles.summaryDescription}>
                  저장된 진료 요약을 항목별로 나누어 쉽게 확인할 수 있도록 정리했습니다.
                </Text>
              </View>
              <StatusBadge label={summary.hasContent ? '요약 저장됨' : '요약 없음'} tone={summary.hasContent ? 'success' : 'warning'} />
            </View>

            {!summary.hasContent ? (
              <Notice tone="warning">
                현재 아카이브 응답에는 저장된 진료 요약이 없습니다. 아래 항목은 데이터 구조만 표시하며 내용을 임의로 생성하지 않습니다.
              </Notice>
            ) : null}

            {summary.overview ? (
              <View style={styles.overviewCard}>
                <Text style={styles.summaryCardEyebrow}>OVERVIEW</Text>
                <Text style={styles.summaryCardTitle}>전체 요약</Text>
                <Text selectable style={styles.overviewText}>{summary.overview}</Text>
              </View>
            ) : null}

            <View style={styles.summaryGrid}>
              {([
                ['주요 증상', '대화에서 확인된 증상과 불편한 점', summary.mainSymptoms, styles.summaryAccentPrimary],
                ['의료진 소견', '진료 중 전달된 판단과 설명', summary.doctorOpinion, styles.summaryAccentSuccess],
                ['처방·생활 관리', '기억해야 할 치료 및 생활 안내', summary.remember, styles.summaryAccentWarning],
                ['질문과 답변', '진료 중 직접 확인한 내용', summary.questionAnswer, styles.summaryAccentInk],
                ['어려운 용어', '의학 용어와 이해를 돕는 설명', summary.difficultWords, styles.summaryAccentMuted],
              ] as [string, string, string | undefined, ViewStyle][]).map(([title, description, value, accent]) => (
                <View
                  key={title}
                  style={[
                    styles.summaryItemCard,
                    wide && styles.summaryItemCardWide,
                    compact && styles.summaryItemCardCompact,
                    accent,
                  ]}
                >
                  <Text style={styles.summaryCardTitle}>{title}</Text>
                  <Text style={styles.summaryCardDescription}>{description}</Text>
                  <SummaryContent value={value} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.transcriptColumn}>
            <View style={styles.columnHeader}>
              <View>
                <Text style={styles.columnEyebrow}>FULL CONVERSATION</Text>
                <Text style={styles.columnTitle}>전체 진료 대화</Text>
              </View>
              <StatusBadge label={`${transcript.length}개 대화`} tone="primary" />
            </View>

            <View style={[styles.transcript, compact && styles.transcriptCompact]}>
              {transcript.length ? transcript.map((item, index) => {
                const mine = item.speaker === '나';
                return (
                  <View key={`${index}-${item.speaker}`} style={[styles.speech, mine && styles.speechMine]}>
                    <View style={[styles.speakerMark, mine && styles.speakerMarkMine]}>
                      <Text style={[styles.speakerMarkText, mine && styles.speakerMarkTextMine]}>
                        {item.speaker.slice(0, 1)}
                      </Text>
                    </View>
                    <View style={[styles.speechCopy, mine && styles.speechCopyMine]}>
                      <Text style={[styles.speakerName, mine && styles.speakerNameMine]}>{item.speaker}</Text>
                      <View style={[styles.speechBubble, mine && styles.speechBubbleMine]}>
                        <Text selectable style={[styles.speechText, mine && styles.speechTextMine]}>{item.text}</Text>
                      </View>
                    </View>
                  </View>
                );
              }) : (
                <EmptyState title="저장된 대화가 없습니다.">
                  이 아카이브에는 전체 진료 대화가 포함되어 있지 않습니다.
                </EmptyState>
              )}
            </View>
          </View>

          <View style={styles.dataCard}>
            <View>
              <Text style={styles.columnEyebrow}>RECORD INFO</Text>
              <Text style={styles.dataTitle}>기록 정보</Text>
            </View>
            <View style={[styles.infoGrid, compact && styles.infoGridCompact]}>
              <InfoRow label="아카이브 번호" value={`#${archive.archiveId}`} />
              <InfoRow label="진료 일시" value={formatDate(archive.archiveDate)} />
              <InfoRow label="대화 수" value={`${transcript.length}개`} />
            </View>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

type ArchiveSummaryView = {
  overview?: string;
  mainSymptoms?: string;
  doctorOpinion?: string;
  remember?: string;
  questionAnswer?: string;
  difficultWords?: string;
  hasContent: boolean;
};

function SummaryContent({ value }: { value?: string }) {
  const lines = toSummaryLines(value);
  if (!lines.length) {
    return <Text style={styles.summaryEmpty}>저장된 내용이 없습니다.</Text>;
  }

  return (
    <View style={styles.summaryContentList}>
      {lines.map((line, index) => (
        <View key={`${index}-${line}`} style={styles.summaryContentRow}>
          <Text style={styles.summaryBullet}>•</Text>
          <Text selectable style={styles.summaryContentText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function buildArchiveSummary(archive: ArchiveDetail | null): ArchiveSummaryView {
  const legacy = parseLegacySummary(archive?.text ?? '');
  const summary = {
    overview: legacy.overview,
    mainSymptoms: cleanSummaryValue(archive?.mainSymptoms) || legacy.mainSymptoms,
    doctorOpinion: cleanSummaryValue(archive?.doctorOpinion) || legacy.doctorOpinion,
    remember: cleanSummaryValue(archive?.remember) || legacy.remember,
    questionAnswer: cleanSummaryValue(archive?.questionAnswer) || legacy.questionAnswer,
    difficultWords: cleanSummaryValue(archive?.difficultWords) || legacy.difficultWords,
  };

  return {
    ...summary,
    hasContent: Object.values(summary).some(Boolean),
  };
}

function parseLegacySummary(value: string): Omit<ArchiveSummaryView, 'hasContent'> {
  const trimmed = value.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const structured = {
      mainSymptoms: cleanSummaryValue(parsed.mainSymptoms),
      doctorOpinion: cleanSummaryValue(parsed.doctorOpinion),
      remember: cleanSummaryValue(parsed.remember),
      questionAnswer: cleanSummaryValue(parsed.questionAnswer),
      difficultWords: cleanSummaryValue(parsed.difficultWords),
    };
    if (Object.values(structured).some(Boolean)) return structured;
  } catch {
    // 기존 아카이브의 일반 텍스트 요약은 아래에서 그대로 표시한다.
  }

  const aliases: Record<string, keyof Omit<ArchiveSummaryView, 'hasContent' | 'overview'>> = {
    '주요 증상': 'mainSymptoms',
    '의료진 소견': 'doctorOpinion',
    '의사 소견': 'doctorOpinion',
    '기억할 내용': 'remember',
    '처방·생활 관리': 'remember',
    '질문과 답변': 'questionAnswer',
    '어려운 용어': 'difficultWords',
  };
  const result: Omit<ArchiveSummaryView, 'hasContent'> = {};
  let activeKey: keyof typeof result | null = null;

  trimmed.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const heading = Object.keys(aliases).find((label) => line === label || line.startsWith(`${label}:`));
    if (heading) {
      activeKey = aliases[heading];
      const inline = line.slice(heading.length).replace(/^:\s*/, '').trim();
      if (inline) result[activeKey] = inline;
      return;
    }
    if (activeKey) {
      result[activeKey] = [result[activeKey], line].filter(Boolean).join('\n');
    }
  });

  if (Object.values(result).some(Boolean)) return result;
  return { overview: trimmed };
}

function cleanSummaryValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toSummaryLines(value?: string) {
  if (!value?.trim()) return [];
  return value
    .split(/\r?\n|(?=•)/)
    .map((line) => line.replace(/^[\s•*-]+/, '').trim())
    .filter(Boolean);
}

function parseTranscript(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{1,20}):\s*(.*)$/);
      return match
        ? { speaker: match[1] === '기관' ? '기관 사용자' : match[1], text: match[2] }
        : { speaker: '진료 대화', text: line };
    });
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 8 },
  content: { width: '100%', gap: 22 },
  summarySection: { width: '100%', gap: 14 },
  summaryLead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, paddingVertical: 8 },
  summaryLeadCompact: { flexDirection: 'column' },
  summaryLeadCopy: { flex: 1, minWidth: 0 },
  summaryEyebrow: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  summaryHeading: { color: colors.text, fontFamily, fontSize: 31, lineHeight: 42, fontWeight: '900', letterSpacing: -0.8, marginTop: 7 },
  summaryHeadingCompact: { fontSize: 25, lineHeight: 35 },
  summaryDescription: { color: colors.muted, fontFamily, fontSize: 11, lineHeight: 19, marginTop: 7 },
  overviewCard: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.primarySoft, padding: 22 },
  overviewText: { color: colors.textSoft, fontFamily, fontSize: 13, lineHeight: 23, marginTop: 13 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  summaryItemCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 340,
    minHeight: 190,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 22,
  },
  summaryItemCardWide: { flexBasis: '31%', minWidth: 0, minHeight: 230 },
  summaryItemCardCompact: { flexBasis: '100%', minWidth: 0 },
  summaryAccentPrimary: { borderTopColor: colors.primary },
  summaryAccentSuccess: { borderTopColor: colors.success },
  summaryAccentWarning: { borderTopColor: colors.warning },
  summaryAccentInk: { borderTopColor: colors.ink },
  summaryAccentMuted: { borderTopColor: colors.muted },
  summaryCardEyebrow: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  summaryCardTitle: { color: colors.text, fontFamily, fontSize: 18, fontWeight: '900' },
  summaryCardDescription: { color: colors.muted, fontFamily, fontSize: 11, lineHeight: 18, marginTop: 6 },
  summaryContentList: { gap: 9, marginTop: 16 },
  summaryContentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  summaryBullet: { width: 10, color: colors.primary, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '900' },
  summaryContentText: { flex: 1, color: colors.textSoft, fontFamily, fontSize: 14, lineHeight: 24 },
  summaryEmpty: { color: colors.faint, fontFamily, fontSize: 13, lineHeight: 21, marginTop: 20 },
  transcriptColumn: { width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  columnHeader: { minHeight: 88, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  columnEyebrow: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  columnTitle: { color: colors.text, fontFamily, fontSize: 18, fontWeight: '900', marginTop: 6 },
  transcript: { width: '100%', minHeight: 520, paddingHorizontal: 32, paddingVertical: 28 },
  transcriptCompact: { paddingHorizontal: 18 },
  speech: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 22 },
  speechMine: { flexDirection: 'row-reverse' },
  speakerMark: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  speakerMarkMine: { backgroundColor: colors.primary },
  speakerMarkText: { color: colors.textSoft, fontFamily, fontSize: 10, fontWeight: '900' },
  speakerMarkTextMine: { color: '#fff' },
  speechCopy: { maxWidth: '78%', minWidth: 0, alignItems: 'flex-start' },
  speechCopyMine: { alignItems: 'flex-end' },
  speakerName: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  speakerNameMine: { color: colors.primary },
  speechBubble: { marginTop: 7, borderRadius: 18, borderBottomLeftRadius: 5, backgroundColor: colors.surfaceSoft, paddingHorizontal: 16, paddingVertical: 12 },
  speechBubbleMine: { borderBottomLeftRadius: 18, borderBottomRightRadius: 5, backgroundColor: colors.primary },
  speechText: { color: colors.textSoft, fontFamily, fontSize: 14, lineHeight: 23 },
  speechTextMine: { color: '#fff' },
  dataCard: { width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 22, gap: 14 },
  dataTitle: { color: colors.text, fontFamily, fontSize: 16, fontWeight: '900', marginTop: 6 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoGridCompact: { flexDirection: 'column' },
  infoRow: { flex: 1, minWidth: 180, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSoft, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  infoLabel: { color: colors.muted, fontFamily, fontSize: 9, fontWeight: '800' },
  infoValue: { color: colors.text, fontFamily, fontSize: 9, fontWeight: '900', textAlign: 'right' },
});
