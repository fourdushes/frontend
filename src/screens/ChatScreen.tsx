import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

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
  formatDate,
} from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { AiResponse, ChatMessage, ChatRoom } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
type RecordingStatus = 'IDLE' | 'RECORDING' | 'READY' | 'UPLOADING' | 'CONVERTING';

export function ChatScreen({ navigation, route }: Props) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const stacked = width < 1080;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [summary, setSummary] = useState<AiResponse | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('IDLE');
  const refreshing = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const chatRoomId = route.params.chatRoomId;
  const isWard = session?.userType === 'WARD';
  const isInstitution = session?.userType === 'INSTITUTIONS';
  const completed = room?.status === 'COMPLETED' || Boolean(summary);

  const refresh = useCallback(async (silent = false) => {
    if ((!isWard && !isInstitution) || refreshing.current) return;
    refreshing.current = true;
    if (!silent) setLoading(true);
    try {
      const [nextMessages, nextRoom] = await Promise.all([
        isInstitution
          ? teamApi.getInstitutionMessages(chatRoomId)
          : teamApi.getWardMessages(chatRoomId),
        isWard ? teamApi.getChatRoom(chatRoomId) : Promise.resolve(null),
      ]);
      setMessages(nextMessages ?? []);
      if (nextRoom) setRoom(nextRoom);
      setError(null);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      refreshing.current = false;
      if (!silent) setLoading(false);
    }
  }, [chatRoomId, isInstitution, isWard]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || completed) return;
    const timer = setInterval(() => void refresh(true), 2500);
    return () => clearInterval(timer);
  }, [autoRefresh, completed, refresh]);

  async function sendMessage() {
    const value = content.trim();
    if (!value || !isWard || sending || completed) return;
    setSending(true);
    setError(null);
    try {
      const message = await teamApi.sendWardMessage(chatRoomId, value);
      setMessages((current) => current.some((item) => item.messageId === message.messageId)
        ? current
        : [...current, message]);
      setContent('');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setSending(false);
    }
  }

  async function completeTreatment() {
    if (!isWard || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await teamApi.completeTreatment(chatRoomId);
      setSummary(response);
      setRoom((current) => current ? { ...current, status: 'COMPLETED' } : current);
      setAutoRefresh(false);
      setCompletionOpen(false);
      await refresh(true);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (!isInstitution || completed) return;
    setError(null);
    setRecordingUri(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('음성 답변을 녹음하려면 브라우저 또는 기기에서 마이크 권한을 허용해 주세요.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingStatus('RECORDING');
    } catch (caught) {
      setError(recordingError(caught));
      setRecordingStatus('IDLE');
    }
  }

  async function stopRecording() {
    if (recordingStatus !== 'RECORDING') return;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) throw new Error('녹음 파일을 만들지 못했습니다.');
      setRecordingUri(recorder.uri);
      setRecordingStatus('READY');
    } catch (caught) {
      setError(recordingError(caught));
      setRecordingStatus('IDLE');
    }
  }

  async function sendRecording() {
    if (!recordingUri || recordingStatus !== 'READY' || completed) return;
    setError(null);
    setRecordingStatus('UPLOADING');
    try {
      const formData = new FormData();
      if (recordingUri.startsWith('blob:')) {
        const response = await fetch(recordingUri);
        const blob = await response.blob();
        formData.append('file', blob, `hearo-${Date.now()}.webm`);
      } else {
        formData.append('file', {
          uri: recordingUri,
          name: `hearo-${Date.now()}.m4a`,
          type: 'audio/mp4',
        } as never);
      }
      setRecordingStatus('CONVERTING');
      const message = await teamApi.uploadRecording(chatRoomId, formData);
      setMessages((current) => [...current, message]);
      setRecordingUri(null);
      setRecordingStatus('IDLE');
    } catch (caught) {
      setError(readableError(caught));
      setRecordingStatus('READY');
    }
  }

  function discardRecording() {
    setRecordingUri(null);
    setRecordingStatus('IDLE');
  }

  if (session?.userType === 'GUARDIAN') {
    return (
      <Screen>
        <PageHeader
          eyebrow="ACCESS LIMITED"
          title="보호자는 진료 대화에 참여하지 않습니다."
          description="진료가 완료된 뒤 연결된 피보호자의 아카이브에서 기록을 확인할 수 있습니다."
          actions={<Button title="기록으로 이동" onPress={() => navigation.navigate('ArchiveList')} />}
        />
      </Screen>
    );
  }

  const participantName = room
    ? isWard ? room.institutionUser.name : room.wardUser.name
    : messages.find((message) => !message.mine)?.senderName;

  return (
    <Screen contentStyle={styles.screen}>
      <PageHeader
        eyebrow="LIVE TREATMENT NOTE"
        title={participantName ? `${participantName}님과의 진료 대화` : `진료 대화방 #${chatRoomId}`}
        description={
          room
            ? `${formatDate(room.startedAt)} 시작 · 대화방 #${chatRoomId}`
            : `서버에 저장된 메시지를 시간순으로 표시합니다.`
        }
        actions={
          <View style={styles.headerActions}>
            <Pressable onPress={() => setAutoRefresh((value) => !value)}>
              <StatusBadge
                label={autoRefresh && !completed ? '자동 동기화' : '수동 동기화'}
                tone={autoRefresh && !completed ? 'success' : 'neutral'}
              />
            </Pressable>
            <Button
              title="새로고침"
              tone="secondary"
              compact
              onPress={() => refresh()}
              disabled={loading}
            />
          </View>
        }
      />

      {error ? <Notice tone="error" title="대화를 처리하지 못했습니다.">{error}</Notice> : null}
      {completed ? (
        <Notice tone="success" title="진료가 종료되었습니다.">
          추가 메시지와 녹음은 제한되며 완료된 기록은 아카이브에서 확인할 수 있습니다.
        </Notice>
      ) : null}

      <View style={[styles.chatLayout, stacked && styles.chatLayoutStacked]}>
        <View style={[styles.transcriptColumn, stacked && styles.transcriptColumnStacked]}>
          <View style={styles.transcriptHeader}>
            <View>
              <Text style={styles.columnEyebrow}>CONVERSATION</Text>
              <Text style={styles.columnTitle}>진료 대화</Text>
            </View>
            <StatusBadge label={`${messages.length}개 메시지`} tone="primary" />
          </View>

          <View style={styles.messageArea}>
            {loading ? <LoadingState label="대화 내용을 불러오고 있습니다." /> : null}
            {!loading && !messages.length ? (
              <EmptyState title="아직 저장된 대화가 없습니다.">
                진료가 시작되면 기관 사용자의 첫 메시지가 표시됩니다.
              </EmptyState>
            ) : null}
            {messages.map((message, index) => {
              const mine = message.mine;
              const voice = message.messageType === 'VOICE_TRANSCRIPT';
              return (
                <View
                  key={message.messageId}
                  style={[
                    styles.messageRow,
                    mine && styles.messageRowMine,
                    index > 0 && messages[index - 1].senderId === message.senderId && styles.messageRowGrouped,
                  ]}
                >
                  {!mine ? (
                    <View style={styles.senderAvatar}>
                      <Text style={styles.senderAvatarText}>{message.senderName.slice(0, 1)}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.messageBlock, mine && styles.messageBlockMine]}>
                    <View style={[styles.messageMeta, mine && styles.messageMetaMine]}>
                      <Text style={styles.senderName}>{mine ? '나' : message.senderName}</Text>
                      {voice ? <StatusBadge label="음성 변환" tone="primary" /> : null}
                      <Text style={styles.messageTime}>{formatMessageTime(message.createdAt)}</Text>
                    </View>
                    <Text selectable style={styles.messageText}>{message.content}</Text>
                    {message.recordId ? (
                      <Text style={styles.recordMeta}>녹음 기록 #{message.recordId}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {!completed && isWard ? (
            <View style={styles.composer}>
              <Field
                label="피보호자 메시지"
                value={content}
                onChangeText={setContent}
                onSubmitEditing={sendMessage}
                multiline
                placeholder="의료진에게 전달할 내용을 입력하세요."
                editable={!sending}
                hint={`${content.trim().length}자`}
              />
              <View style={styles.composerActions}>
                <View style={styles.composerHint}>
                  <Text style={styles.composerHintIcon}>i</Text>
                  <Text style={styles.composerHintText}>전송된 메시지는 진료 기록에 포함됩니다.</Text>
                </View>
                <View style={styles.sendButton}>
                  <Button
                    title={sending ? '전송 중…' : '메시지 전송'}
                    onPress={sendMessage}
                    disabled={sending || !content.trim()}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {!completed && isInstitution ? (
            <View style={styles.recorder}>
              <View style={styles.recorderHeader}>
                <View style={[styles.recordDot, recordingStatus === 'RECORDING' && styles.recordDotActive]} />
                <View style={styles.recorderCopy}>
                  <Text style={styles.recorderTitle}>{recordingLabel(recordingStatus)}</Text>
                  <Text style={styles.recorderText}>
                    {recordingStatus === 'RECORDING'
                      ? `${formatDuration(recorderState.durationMillis)} 동안 녹음 중입니다.`
                      : recordingStatus === 'READY'
                        ? '녹음을 서버로 보내기 전 다시 녹음할 수 있습니다.'
                        : recordingStatus === 'UPLOADING'
                          ? '녹음 파일을 안전하게 업로드하고 있습니다.'
                          : recordingStatus === 'CONVERTING'
                            ? '서버에서 음성을 텍스트로 변환하고 있습니다.'
                            : '마이크 권한을 확인한 뒤 음성 답변을 녹음하세요.'}
                  </Text>
                </View>
                <StatusBadge
                  label={recordingStatus === 'RECORDING' ? '녹음 중' : recordingStatus === 'READY' ? '전송 준비' : '대기'}
                  tone={recordingStatus === 'RECORDING' ? 'danger' : recordingStatus === 'READY' ? 'primary' : 'neutral'}
                />
              </View>
              <View style={styles.recordActions}>
                <Button
                  title="녹음 시작"
                  onPress={startRecording}
                  disabled={recordingStatus !== 'IDLE'}
                />
                <Button
                  title="녹음 정지"
                  tone="secondary"
                  onPress={stopRecording}
                  disabled={recordingStatus !== 'RECORDING'}
                />
                {recordingStatus === 'READY' ? (
                  <>
                    <Button title="다시 녹음" tone="ghost" onPress={discardRecording} />
                    <Button title="음성 답변 전송" onPress={sendRecording} />
                  </>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.contextColumn, stacked && styles.contextColumnStacked]}>
          <View style={styles.sessionCard}>
            <Text style={styles.columnEyebrow}>SESSION</Text>
            <Text style={styles.sessionTitle}>진료 정보</Text>
            <InfoRow label="상태" value={completed ? '진료 종료' : '진료 진행 중'} />
            <InfoRow label="대화방" value={`#${chatRoomId}`} />
            {room ? <InfoRow label="아카이브" value={`#${room.archiveId}`} /> : null}
            {room ? <InfoRow label="시작 시각" value={formatDate(room.startedAt)} /> : null}
          </View>

          {summary ? (
            <View style={styles.summaryPanel}>
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={styles.columnEyebrow}>AI SUMMARY</Text>
                  <Text style={styles.summaryTitle}>진료 요약</Text>
                </View>
                <StatusBadge label="생성 완료" tone="success" />
              </View>
              {[
                ['주요 증상', summary.mainSymptoms],
                ['의료진 의견', summary.doctorOpinion],
                ['기억할 내용', summary.remember],
                ['질문과 답변', summary.questionAnswer],
                ['어려운 용어', summary.difficultWords],
              ].map(([title, copy]) => (
                <View key={title} style={styles.summaryItem}>
                  <Text style={styles.summaryItemTitle}>{title}</Text>
                  <Text selectable style={styles.summaryItemText}>{copy}</Text>
                </View>
              ))}
              <Button
                title="아카이브로 이동"
                tone="secondary"
                onPress={() => navigation.navigate('ArchiveDetail', { archiveId: summary.archiveId })}
              />
            </View>
          ) : (
            <View style={styles.guidePanel}>
              <Text style={styles.columnEyebrow}>CARE GUIDE</Text>
              <Text style={styles.guideTitle}>진료 대화 안내</Text>
              {isWard ? (
                <>
                  <GuideRow number="01" text="증상과 불편한 점을 구체적으로 입력하세요." />
                  <GuideRow number="02" text="의료진의 음성 답변은 텍스트로 표시됩니다." />
                  <GuideRow number="03" text="대화가 끝나면 직접 진료를 종료하세요." />
                </>
              ) : (
                <>
                  <GuideRow number="01" text="기관 사용자는 텍스트를 직접 입력하지 않습니다." />
                  <GuideRow number="02" text="녹음 정지 후 음성 답변을 전송하세요." />
                  <GuideRow number="03" text="변환 결과가 대화에 표시되는지 확인하세요." />
                </>
              )}
            </View>
          )}

          {isWard && !completed ? (
            <View style={styles.completeCard}>
              <Text style={styles.completeTitle}>진료를 마치셨나요?</Text>
              <Text style={styles.completeText}>
                종료하면 추가 입력이 막히고 AI 요약 생성을 요청합니다.
              </Text>
              <Button
                title="진료 종료"
                tone="danger"
                onPress={() => setCompletionOpen(true)}
                disabled={sending}
              />
            </View>
          ) : null}
        </View>
      </View>

      <ConfirmDialog
        visible={completionOpen}
        title="진료를 종료할까요?"
        description="종료 후에는 메시지와 녹음을 추가할 수 없으며, 전체 대화를 바탕으로 AI 요약을 생성합니다."
        confirmLabel="진료 종료"
        destructive
        busy={sending}
        onCancel={() => setCompletionOpen(false)}
        onConfirm={completeTreatment}
      />
    </Screen>
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

function GuideRow({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.guideRow}>
      <Text style={styles.guideNumber}>{number}</Text>
      <Text style={styles.guideText}>{text}</Text>
    </View>
  );
}

function recordingLabel(status: RecordingStatus) {
  if (status === 'RECORDING') return '음성 답변 녹음 중';
  if (status === 'READY') return '녹음 완료 · 전송 준비';
  if (status === 'UPLOADING') return '녹음 파일 업로드 중';
  if (status === 'CONVERTING') return '음성을 텍스트로 변환 중';
  return '음성 답변 녹음';
}

function recordingError(error: unknown) {
  const message = readableError(error);
  return message.includes('NotAllowed') || message.includes('Permission')
    ? '마이크 권한이 거부되었습니다. 브라우저 설정에서 HearO의 마이크 사용을 허용해 주세요.'
    : message;
}

function formatDuration(milliseconds: number) {
  const total = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  screen: { maxWidth: 1540 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatLayout: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  chatLayoutStacked: { flexDirection: 'column', alignItems: 'stretch' },
  transcriptColumn: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  transcriptColumnStacked: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  contextColumn: { width: 360, gap: 14 },
  contextColumnStacked: { width: '100%', flexDirection: 'row', flexWrap: 'wrap' },
  transcriptHeader: { minHeight: 82, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  columnEyebrow: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  columnTitle: { color: colors.text, fontFamily, fontSize: 18, fontWeight: '900', marginTop: 5 },
  messageArea: { minHeight: 420, padding: 22 },
  messageRow: { maxWidth: '88%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 23 },
  messageRowMine: { alignSelf: 'flex-end' },
  messageRowGrouped: { marginTop: -13 },
  senderAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  senderAvatarText: { color: colors.textSoft, fontFamily, fontSize: 11, fontWeight: '900' },
  messageBlock: { flexShrink: 1, borderRadius: 4, borderBottomRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: 14 },
  messageBlockMine: { borderTopRightRadius: 4, borderTopLeftRadius: radius.lg, backgroundColor: colors.primarySoft },
  messageMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  messageMetaMine: { justifyContent: 'flex-end' },
  senderName: { color: colors.text, fontFamily, fontSize: 9, fontWeight: '900' },
  messageTime: { color: colors.faint, fontFamily, fontSize: 8 },
  messageText: { color: colors.textSoft, fontFamily, fontSize: 13, lineHeight: 21 },
  recordMeta: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '800', marginTop: 8 },
  composer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.canvas, padding: 19, gap: 12 },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  composerHint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  composerHintIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primarySoft, color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', textAlign: 'center', lineHeight: 18 },
  composerHintText: { color: colors.muted, fontFamily, fontSize: 9 },
  sendButton: { minWidth: 140 },
  recorder: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.canvas, padding: 19, gap: 13 },
  recorderHeader: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  recordDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.faint },
  recordDotActive: { backgroundColor: colors.danger },
  recorderCopy: { flex: 1 },
  recorderTitle: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  recorderText: { color: colors.muted, fontFamily, fontSize: 9, lineHeight: 15, marginTop: 4 },
  recordActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sessionCard: { flex: 1, minWidth: 320, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 21 },
  sessionTitle: { color: colors.text, fontFamily, fontSize: 17, fontWeight: '900', marginTop: 6, marginBottom: 15 },
  infoRow: { minHeight: 40, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  infoLabel: { color: colors.muted, fontFamily, fontSize: 9, fontWeight: '800' },
  infoValue: { color: colors.text, fontFamily, fontSize: 9, fontWeight: '900' },
  summaryPanel: { flex: 1, minWidth: 320, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.primarySoft, padding: 20, gap: 10 },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  summaryTitle: { color: colors.text, fontFamily, fontSize: 17, fontWeight: '900', marginTop: 6 },
  summaryItem: { borderRadius: radius.md, backgroundColor: colors.surface, padding: 14 },
  summaryItemTitle: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900' },
  summaryItemText: { color: colors.textSoft, fontFamily, fontSize: 10, lineHeight: 17, marginTop: 6 },
  guidePanel: { flex: 1, minWidth: 320, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 21 },
  guideTitle: { color: colors.text, fontFamily, fontSize: 16, fontWeight: '900', marginTop: 6, marginBottom: 13 },
  guideRow: { minHeight: 58, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  guideNumber: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900' },
  guideText: { flex: 1, color: colors.textSoft, fontFamily, fontSize: 10, lineHeight: 16 },
  completeCard: { flex: 1, minWidth: 320, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.primarySoft, padding: 21, gap: 10 },
  completeTitle: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '900' },
  completeText: { color: colors.textSoft, fontFamily, fontSize: 9, lineHeight: 16, marginBottom: 6 },
});
