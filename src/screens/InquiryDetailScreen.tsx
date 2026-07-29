import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import {
  Button,
  formatDate,
  LoadingState,
  Notice,
  PageHeader,
  Screen,
  Section,
  StatusBadge,
  uiStyles,
} from '../components/Ui';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { Inquiry } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'InquiryDetail'>;

export function InquiryDetailScreen({ navigation, route }: Props) {
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInquiry(await teamApi.getInquiry(route.params.inquiryId));
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [route.params.inquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const answered = inquiry?.status === 'ANSWERED';

  return (
    <Screen>
      <PageHeader
        eyebrow="SUPPORT DETAIL"
        title={inquiry?.title || '문의 상세'}
        description="내가 등록한 문의 내용과 현재 답변 상태를 확인합니다."
        actions={<Button title="목록으로" tone="secondary" compact onPress={() => navigation.navigate('Inquiry', { mode: undefined })} />}
      />

      {error ? (
        <Notice tone="error" title="문의 상세를 불러오지 못했습니다.">{error}</Notice>
      ) : null}

      {loading ? (
        <Section><LoadingState label="문의 상세 정보를 불러오고 있습니다." /></Section>
      ) : inquiry ? (
        <>
          <Section>
            <View style={styles.metaRow}>
              <StatusBadge
                label={answered ? '답변 완료' : '답변 대기'}
                tone={answered ? 'success' : 'warning'}
              />
              <Text style={styles.meta}>등록 {formatDate(inquiry.createdAt)}</Text>
              {inquiry.answeredAt ? <Text style={styles.meta}>답변 {formatDate(inquiry.answeredAt)}</Text> : null}
            </View>
            <View style={styles.messageBlock}>
              <Text style={styles.blockLabel}>문의 내용</Text>
              <Text style={styles.messageText}>{inquiry.content}</Text>
            </View>
          </Section>

          <Section
            title="HearO 답변"
            description={answered ? '문의에 등록된 답변입니다.' : '담당자가 문의 내용을 확인하고 있습니다.'}
          >
            {inquiry.answer ? (
              <View style={styles.answerBlock}>
                <View style={styles.answerMark}><Text style={styles.answerMarkText}>H</Text></View>
                <View style={uiStyles.flex}>
                  <Text style={styles.answerLabel}>HearO 고객 지원</Text>
                  <Text style={styles.answerText}>{inquiry.answer}</Text>
                </View>
              </View>
            ) : (
              <Notice tone="warning" title="답변을 기다리고 있습니다.">
                답변이 등록되면 이 화면에서 바로 확인할 수 있습니다.
              </Notice>
            )}
          </Section>

          <View style={styles.footerActions}>
            <Button title="목록으로 돌아가기" tone="secondary" onPress={() => navigation.navigate('Inquiry', { mode: undefined })} />
            <Button title="새 문의 작성" onPress={() => navigation.navigate('Inquiry', { mode: 'create' })} />
          </View>
        </>
      ) : (
        <Section>
          <Notice tone="warning">표시할 문의 정보가 없습니다.</Notice>
          <Button title="문의 목록으로" tone="secondary" onPress={() => navigation.navigate('Inquiry', { mode: undefined })} />
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  meta: { color: colors.muted, fontFamily, fontSize: 10 },
  messageBlock: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: 20,
  },
  blockLabel: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  messageText: { color: colors.text, fontFamily, fontSize: 14, lineHeight: 24, marginTop: 12 },
  answerBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: 20,
  },
  answerMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerMarkText: { color: '#fff', fontFamily, fontSize: 14, fontWeight: '900' },
  answerLabel: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  answerText: { color: colors.text, fontFamily, fontSize: 14, lineHeight: 24, marginTop: 8 },
  footerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
});
