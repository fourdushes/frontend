import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import {
  Button,
  EmptyState,
  Field,
  formatDate,
  LoadingState,
  Notice,
  PageHeader,
  Screen,
  Section,
  StatusBadge,
  Tabs,
  uiStyles,
} from '../components/Ui';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { Inquiry, InquiryList } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Inquiry'>;
type InquiryTab = 'LIST' | 'CREATE';

const EMPTY_LIST: InquiryList = {
  totalElements: 0,
  page: 0,
  size: 10,
  hasNext: false,
  inquiries: [],
};

export function InquiryScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<InquiryTab>('LIST');
  const [page, setPage] = useState(0);
  const [list, setList] = useState<InquiryList>(EMPTY_LIST);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const result = await teamApi.getInquiries(targetPage);
      setList(result ?? { ...EMPTY_LIST, page: targetPage });
      setPage(targetPage);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load(0);
  }, []);

  useEffect(() => {
    setTab(route.params?.mode === 'create' ? 'CREATE' : 'LIST');
  }, [route.params?.mode]);

  async function submit() {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle || !cleanContent || submitting) return;
    if (cleanTitle.length > 100 || cleanContent.length > 5000) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await teamApi.createInquiry(cleanTitle, cleanContent);
      setTitle('');
      setContent('');
      setSuccess('문의가 등록되었습니다. 상세 화면에서 답변 상태를 확인할 수 있습니다.');
      navigation.navigate('InquiryDetail', { inquiryId: created.inquiryId });
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const titleError = title.length > 100 ? '제목은 100자 이하여야 합니다.' : null;
  const contentError = content.length > 5000 ? '내용은 5000자 이하여야 합니다.' : null;
  const canSubmit = Boolean(title.trim() && content.trim() && !titleError && !contentError);

  return (
    <Screen>
      <PageHeader
        eyebrow="HEARO SUPPORT"
        title="문의하기"
        description="이용 중 궁금한 내용을 남기고, 내가 등록한 문의의 답변 상태를 확인하세요."
        actions={
          <Button
            title={tab === 'LIST' ? '새 문의 작성' : '문의 목록 보기'}
            compact
            onPress={() => setTab(tab === 'LIST' ? 'CREATE' : 'LIST')}
          />
        }
      />

      <Tabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          setError(null);
          setSuccess(null);
        }}
        options={[
          { value: 'LIST', label: '나의 문의', count: list.totalElements },
          { value: 'CREATE', label: '문의 등록' },
        ]}
      />

      {error ? <Notice tone="error" title="문의 정보를 처리하지 못했습니다.">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {tab === 'CREATE' ? (
        <View style={[styles.composeLayout, width < 980 && styles.composeLayoutStack]}>
          <Section
            title="새 문의"
            description="등록 후에는 내용을 수정할 수 없으니 한 번 더 확인해 주세요."
            style={styles.composeSection}
          >
            <Field
              label="제목"
              hint={`${title.length}/100`}
              error={titleError}
              value={title}
              maxLength={101}
              onChangeText={setTitle}
              placeholder="문의 내용을 한 문장으로 적어주세요"
            />
            <Field
              label="내용"
              hint={`${content.length}/5000`}
              error={contentError}
              value={content}
              maxLength={5001}
              multiline
              numberOfLines={9}
              onChangeText={setContent}
              placeholder="확인이 필요한 상황과 이용 중인 기능을 자세히 적어주세요."
            />
            <View style={styles.formActions}>
              <Button
                title="작성 취소"
                tone="secondary"
                disabled={submitting}
                onPress={() => {
                  setTitle('');
                  setContent('');
                  setTab('LIST');
                }}
              />
              <Button
                title={submitting ? '등록 중…' : '문의 등록'}
                disabled={!canSubmit || submitting}
                onPress={submit}
              />
            </View>
          </Section>

          <Section title="등록 전 확인" style={styles.guideSection}>
            <Guide number="01" title="계정 정보는 자동으로 연결됩니다." copy="로그인한 사용자 본인의 문의로 안전하게 등록됩니다." />
            <Guide number="02" title="API가 제공하는 필드만 사용합니다." copy="현재 등록 가능한 항목은 제목과 내용이며 첨부파일이나 문의 유형은 지원되지 않습니다." />
            <Guide number="03" title="답변 상태를 확인할 수 있습니다." copy="문의 목록과 상세 화면에서 대기 또는 답변 완료 상태를 확인하세요." />
          </Section>
        </View>
      ) : (
        <Section
          title={`나의 문의 ${list.totalElements}건`}
          description="최근 등록한 순서로 표시됩니다. 항목을 선택하면 문의 내용과 답변을 확인할 수 있습니다."
          action={<Button title="새로고침" tone="secondary" compact disabled={loading} onPress={() => load(page)} />}
        >
          {loading ? (
            <LoadingState label="내 문의 목록을 불러오고 있습니다." />
          ) : list.inquiries.length === 0 ? (
            <EmptyState
              title="등록한 문의가 없습니다."
              action={<Button title="첫 문의 작성" tone="ghost" onPress={() => setTab('CREATE')} />}
            >
              서비스 이용 중 도움이 필요한 내용을 남겨주세요.
            </EmptyState>
          ) : (
            <View style={styles.list}>
              {list.inquiries.map((item) => (
                <InquiryRow
                  key={item.inquiryId}
                  item={item}
                  onPress={() => navigation.navigate('InquiryDetail', { inquiryId: item.inquiryId })}
                />
              ))}
            </View>
          )}

          {!loading && (page > 0 || list.hasNext) ? (
            <View style={styles.pagination}>
              <Button
                title="이전"
                tone="secondary"
                compact
                disabled={page === 0}
                onPress={() => load(page - 1)}
              />
              <Text style={styles.pageLabel}>{page + 1} 페이지</Text>
              <Button
                title="다음"
                tone="secondary"
                compact
                disabled={!list.hasNext}
                onPress={() => load(page + 1)}
              />
            </View>
          ) : null}
        </Section>
      )}
    </Screen>
  );
}

function InquiryRow({ item, onPress }: { item: Inquiry; onPress: () => void }) {
  const answered = item.status === 'ANSWERED';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${item.title} 문의 상세 보기`}
      onPress={onPress}
      style={({ pressed }) => [styles.inquiryRow, pressed && styles.inquiryRowPressed]}
    >
      <View style={styles.inquiryMain}>
        <View style={uiStyles.row}>
          <StatusBadge label={answered ? '답변 완료' : '답변 대기'} tone={answered ? 'success' : 'warning'} />
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.inquiryTitle}>{item.title}</Text>
        <Text numberOfLines={2} style={styles.inquiryPreview}>{item.content}</Text>
      </View>
      <Text aria-hidden style={styles.arrow}>›</Text>
    </Pressable>
  );
}

function Guide({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <View style={styles.guide}>
      <Text style={styles.guideNumber}>{number}</Text>
      <View style={uiStyles.flex}>
        <Text style={styles.guideTitle}>{title}</Text>
        <Text style={styles.guideCopy}>{copy}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composeLayout: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  composeLayoutStack: { flexDirection: 'column' },
  composeSection: { flex: 1, width: '100%' },
  guideSection: { width: 350, maxWidth: '100%' },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
  guide: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  guideNumber: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  guideTitle: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  guideCopy: { color: colors.muted, fontFamily, fontSize: 10, lineHeight: 17, marginTop: 4 },
  list: { gap: spacing.sm },
  inquiryRow: {
    minHeight: 128,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 18,
  },
  inquiryRowPressed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  inquiryMain: { flex: 1, minWidth: 0 },
  date: { color: colors.faint, fontFamily, fontSize: 10 },
  inquiryTitle: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '900', marginTop: 12 },
  inquiryPreview: { color: colors.muted, fontFamily, fontSize: 11, lineHeight: 18, marginTop: 6 },
  arrow: { color: colors.primary, fontFamily, fontSize: 28, fontWeight: '400' },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  pageLabel: { color: colors.muted, fontFamily, fontSize: 11, fontWeight: '800' },
});
