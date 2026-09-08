import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Platform,
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

import { AudioQueueItem, useAutoVoiceRecorder } from '../audio/useAutoVoiceRecorder';
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
import { useTreatmentRequest } from '../context/TreatmentRequestContext';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { AiResponse, ChatMessage, ChatRoom } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
type RecordingStatus = 'IDLE' | 'RECORDING' | 'READY' | 'UPLOADING' | 'CONVERTING';

export function ChatScreen({ navigation, route }: Props) {
  const { session } = useSession();
  const { inProgressRequest, refresh: refreshTreatmentRequests } = useTreatmentRequest();
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
  const [exitBlocked, setExitBlocked] = useState(false);
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
  const treatmentLocked = !completed && (room?.status === 'IN_PROGRESS' || inProgressRequest?.chatRoomId === chatRoomId);
  const autoVoice = useAutoVoiceRecorder({
    available: Boolean(isInstitution && Platform.OS === 'web'),
    treatmentCompleted: completed,
    upload: uploadAutoVoice,
    onUploaded: (message) => {
      setMessages((current) => current.some((item) => item.messageId === message.messageId)
        ? current
        : [...current, message]);
    },
  });

  const refresh = useCallback(async (silent = false) => {
    if ((!isWard && !isInstitution) || refreshing.current) return;
    refreshing.current = true;
    if (!silent) setLoading(true);
    try {
      const [nextMessages, nextRoom] = await Promise.all([
        isInstitution
          ? teamApi.getInstitutionMessages(chatRoomId)
          : teamApi.getWardMessages(chatRoomId),
        teamApi.getChatRoom(chatRoomId),
      ]);
      setMessages(nextMessages ?? []);
      if (nextRoom) {
        setRoom(nextRoom);
        if (nextRoom.status === 'COMPLETED') void refreshTreatmentRequests(true);
      }
      setError(null);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      refreshing.current = false;
      if (!silent) setLoading(false);
    }
  }, [chatRoomId, isInstitution, isWard, refreshTreatmentRequests]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || completed) return;
    const timer = setInterval(() => void refresh(true), 2500);
    return () => clearInterval(timer);
  }, [autoRefresh, completed, refresh]);

  useEffect(() => {
    if (!treatmentLocked) return;
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
  }, [navigation, treatmentLocked]);

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
      await refreshTreatmentRequests(true);
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

  async function uploadAutoVoice(item: AudioQueueItem) {
    const formData = new FormData();
    formData.append('file', item.blob, `hearo-${item.localId}.wav`);
    return teamApi.uploadRecording(chatRoomId, formData);
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
              {Platform.OS === 'web' ? (
                <AutoVoiceRecorderPanel autoVoice={autoVoice} />
              ) : (
                <>
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
                                : '현재 앱 환경에서는 수동 녹음 방식으로 음성 답변을 전송합니다.'}
                      </Text>
                    </View>
                    <StatusBadge
                      label={recordingStatus === 'RECORDING' ? '녹음 중' : recordingStatus === 'READY' ? '전송 준비' : '대기'}
                      tone={recordingStatus === 'RECORDING' ? 'danger' : recordingStatus === 'READY' ? 'primary' : 'neutral'}
                    />
                  </View>
                  <View style={styles.recordActions}>
                    <Button title="진료 시작하기" onPress={startRecording} disabled={recordingStatus !== 'IDLE'} />
                    <Button title="녹음 정지" tone="secondary" onPress={stopRecording} disabled={recordingStatus !== 'RECORDING'} />
                    {recordingStatus === 'READY' ? (
                      <>
                        <Button title="다시 녹음" tone="ghost" onPress={discardRecording} />
                        <Button title="음성 답변 전송" onPress={sendRecording} />
                      </>
                    ) : null}
                  </View>
                </>
              )}
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
      <ConfirmDialog
        visible={exitBlocked}
        title="진료 중에는 다른 페이지로 이동할 수 없습니다."
        description="피보호자가 진료 종료를 완료하면 메뉴와 다른 페이지를 다시 이용할 수 있습니다. 현재 채팅방에서 진료를 계속해 주세요."
        confirmLabel="진료 계속하기"
        onCancel={() => setExitBlocked(false)}
        onConfirm={() => setExitBlocked(false)}
      />
    </Screen>
  );
}

function AutoVoiceRecorderPanel({ autoVoice }: { autoVoice: ReturnType<typeof useAutoVoiceRecorder> }) {
  const capture = autoCaptureMeta(autoVoice.captureState);
  const pendingCount = autoVoice.queue.filter((item) => ['queued', 'uploading', 'processing'].includes(item.status)).length;
  const completedCount = autoVoice.queue.filter((item) => item.status === 'completed').length;
  const failedCount = autoVoice.queue.filter((item) => item.status === 'failed').length;
  const meterScale = Math.min(100, autoVoice.meter / (autoVoice.thresholds?.startThreshold || 0.05) * 100);
  const canStart = ['IDLE', 'ERROR'].includes(autoVoice.captureState);

  return (
    <>
      <View style={[styles.recorderHeader, styles.autoRecorderHeader]}>
        <View style={[styles.recordDot, ['SPEECH_DETECTED', 'RECORDING', 'SILENCE'].includes(autoVoice.captureState) && styles.recordDotActive]} />
        <View style={styles.recorderCopy}>
          <Text style={styles.autoRecorderTitle}>{capture.title}</Text>
        </View>
        <StatusBadge label={capture.badge} tone={capture.tone} />
      </View>

      <View style={styles.meterCard}>
        <View style={styles.meterHeader}>
          <Text style={styles.meterLabel}>실시간 발화 감지</Text>
          <Text style={styles.meterValue}>
            {autoVoice.captureState === 'CALIBRATING'
              ? '주변 소음 측정 중'
              : autoVoice.thresholds
                ? '주변 소음 보정 완료'
                : '측정 대기'}
          </Text>
        </View>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${meterScale}%` } as never]} />
        </View>
        <Text style={styles.meterHint}>말을 마친 뒤 1.5초 동안 침묵하면 음성 조각을 자동으로 전송합니다.</Text>
      </View>

      {!autoVoice.supported ? <Notice tone="error">현재 브라우저는 자동 발화 녹음을 지원하지 않습니다.</Notice> : null}
      {autoVoice.error ? <Notice tone="error" title="자동 녹음을 확인해 주세요.">{autoVoice.error}</Notice> : null}

      <View style={styles.recordActions}>
        <Button title="진료 시작하기" onPress={autoVoice.start} disabled={!autoVoice.supported || !canStart} />
        <Button title="자동 녹음 종료" tone="secondary" onPress={() => autoVoice.stop(true)} disabled={canStart || autoVoice.captureState === 'COMPLETED'} />
        {failedCount ? <Button title="실패 조각 다시 전송" tone="ghost" onPress={autoVoice.retryFailed} /> : null}
      </View>

      <View style={styles.queueCard}>
        <View style={styles.queueHeader}>
          <View>
            <Text style={styles.queueTitle}>음성 변환 대기</Text>
            <Text style={styles.queueDescription}>발화 순서대로 한 번에 하나씩 텍스트 변환을 요청합니다.</Text>
          </View>
          <StatusBadge label={`대기 ${pendingCount} · 완료 ${completedCount}`} tone={failedCount ? 'danger' : pendingCount ? 'warning' : 'success'} />
        </View>
        {autoVoice.queue.length ? autoVoice.queue.slice(-4).map((item) => {
          const queueMeta = audioQueueMeta(item.status);
          return (
            <View key={item.localId} style={styles.queueRow}>
              <View style={styles.queueSequence}><Text style={styles.queueSequenceText}>{String(item.sequence).padStart(2, '0')}</Text></View>
              <View style={styles.queueCopy}>
                <Text style={styles.queueItemTitle}>음성 조각 #{item.sequence} · {(item.durationMs / 1000).toFixed(1)}초</Text>
                <Text style={styles.queueItemText}>{item.error || `실제 발화 ${(item.speechDurationMs / 1000).toFixed(1)}초 · 재시도 ${item.retryCount}회`}</Text>
              </View>
              <StatusBadge label={queueMeta.label} tone={queueMeta.tone} />
            </View>
          );
        }) : <Text style={styles.queueEmpty}>진료를 시작하면 감지된 발화가 여기에 순서대로 표시됩니다.</Text>}
      </View>
    </>
  );
}

function autoCaptureMeta(state: ReturnType<typeof useAutoVoiceRecorder>['captureState']) {
  if (state === 'REQUESTING_PERMISSION') return { title: '마이크 권한 요청 중', description: '브라우저의 마이크 사용 요청을 확인해 주세요.', badge: '권한 확인', tone: 'warning' as const };
  if (state === 'CALIBRATING') return { title: '주변 소음을 측정 중입니다.', description: '약 1.5초 동안 잠시 말하지 않으면 환경에 맞는 기준을 설정합니다.', badge: '소음 측정', tone: 'warning' as const };
  if (state === 'LISTENING') return { title: '발화를 기다리고 있습니다.', description: '말을 시작하면 자동으로 음성을 감지하고 녹음합니다.', badge: '듣는 중', tone: 'success' as const };
  if (state === 'SPEECH_DETECTED') return { title: '발화를 감지했습니다.', description: '짧은 소음인지 실제 발화인지 확인한 뒤 녹음을 유지합니다.', badge: '발화 감지', tone: 'primary' as const };
  if (state === 'RECORDING') return { title: '음성을 자동 녹음하고 있습니다.', description: '말을 멈추면 침묵 시간을 확인합니다.', badge: '녹음 중', tone: 'danger' as const };
  if (state === 'SILENCE') return { title: '침묵 구간을 확인하고 있습니다.', description: '1.5초 동안 말이 없으면 현재 발화를 분할해 전송합니다.', badge: '침묵 확인', tone: 'warning' as const };
  if (state === 'ERROR') return { title: '자동 녹음이 중지되었습니다.', description: '오류 내용을 확인한 뒤 진료 시작하기를 다시 눌러 주세요.', badge: '오류', tone: 'danger' as const };
  if (state === 'COMPLETED') return { title: '진료가 종료되어 마이크를 닫았습니다.', description: '종료 후에는 새로운 음성 조각을 만들거나 전송하지 않습니다.', badge: '진료 종료', tone: 'neutral' as const };
  return { title: '자동 발화 녹음을 시작해 주세요.', description: '처음 한 번만 진료 시작하기를 누르면 이후 발화를 자동으로 나눠 전송합니다.', badge: '진료 시작 전', tone: 'neutral' as const };
}

function audioQueueMeta(status: AudioQueueItem['status']) {
  if (status === 'queued') return { label: '전송 대기', tone: 'warning' as const };
  if (status === 'uploading') return { label: '업로드 중', tone: 'primary' as const };
  if (status === 'processing') return { label: '텍스트 변환 중', tone: 'primary' as const };
  if (status === 'completed') return { label: '변환 완료', tone: 'success' as const };
  return { label: '전송 실패', tone: 'danger' as const };
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
  autoRecorderHeader: { paddingVertical: 11, paddingHorizontal: 13 },
  autoRecorderTitle: { color: colors.text, fontFamily, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  recorderText: { color: colors.muted, fontFamily, fontSize: 9, lineHeight: 15, marginTop: 4 },
  recordActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meterCard: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: 13, gap: 8 },
  meterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meterLabel: { color: colors.text, fontFamily, fontSize: 9, fontWeight: '900' },
  meterValue: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900' },
  meterTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  meterHint: { color: colors.muted, fontFamily, fontSize: 8, lineHeight: 13 },
  queueCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 13, gap: 9 },
  queueHeader: { gap: 3 },
  queueTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  queueDescription: { color: colors.muted, fontFamily, fontSize: 8, lineHeight: 13 },
  queueRow: { minHeight: 45, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 9 },
  queueSequence: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  queueSequenceText: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900' },
  queueCopy: { flex: 1 },
  queueItemTitle: { color: colors.text, fontFamily, fontSize: 9, fontWeight: '900' },
  queueItemText: { color: colors.muted, fontFamily, fontSize: 8, lineHeight: 13, marginTop: 2 },
  queueEmpty: { borderTopWidth: 1, borderTopColor: colors.border, color: colors.muted, fontFamily, fontSize: 8, lineHeight: 14, paddingTop: 9 },
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
