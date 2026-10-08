import { useResponsiveLayout } from '../components/Responsive';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  Platform,
  ScrollView,
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
type TriageStep = 'MAIN_SYMPTOM' | 'DETAIL_SYMPTOMS' | 'DURATION' | 'COMPLETE';

type MainSymptomOption = {
  label: string;
  details: string[];
};

const MAIN_SYMPTOM_OPTIONS: MainSymptomOption[] = [
  { label: '열이 나요 · 감기 증상이 있어요', details: ['열이 나요', '기침이 나요', '목이 아파요', '콧물·코막힘이 있어요', '가래가 나와요', '몸살처럼 온몸이 아파요'] },
  { label: '배가 아파요 · 소화가 불편해요', details: ['배가 아파요', '설사를 해요', '변비가 있어요', '메스꺼워요·토했어요', '속이 쓰려요', '배가 더부룩해요'] },
  { label: '머리가 아파요 · 어지러워요', details: ['머리가 아파요', '머리가 지끈거려요', '어지러워요', '메스꺼워요', '시야가 불편해요', '목이 뻣뻣해요'] },
  { label: '가슴이 답답해요 · 숨쉬기 불편해요', details: ['가슴이 아파요', '가슴이 답답해요', '숨이 차요', '심장이 두근거려요', '숨쉴 때 아파요', '기침할 때 가슴이 아파요'] },
  { label: '목·어깨가 아파요', details: ['목이 아파요', '목이 잘 안 움직여져요', '어깨가 아파요', '팔까지 통증이 내려와요', '저리거나 힘이 빠져요', '움직일 때 더 아파요'] },
  { label: '허리·등이 아파요', details: ['허리가 아파요', '등이 아파요', '엉덩이까지 아파요', '다리까지 통증이 내려와요', '오래 앉거나 서면 더 아파요', '움직일 때 더 아파요'] },
  { label: '팔·다리·관절이 아파요', details: ['팔·손이 아파요', '다리·발이 아파요', '무릎이 아파요', '관절이 붓거나 뜨거워요', '근육통이 있어요', '저리거나 힘이 빠져요'] },
  { label: '소변 볼 때 불편해요', details: ['소변 볼 때 아파요', '소변이 자주 마려워요', '소변에 피가 보여요', '아랫배가 아파요', '옆구리가 아파요', '소변을 보기 어려워요'] },
  { label: '생리·골반 쪽이 불편해요', details: ['생리통이 심해요', '아랫배·골반이 아파요', '생리량이 평소와 달라요', '생리가 아닌데 출혈이 있어요', '분비물이 평소와 달라요', '허리까지 아파요'] },
  { label: '피부·눈·귀가 불편해요', details: ['피부가 가렵거나 발진이 있어요', '피부가 붓거나 아파요', '눈이 아프거나 충혈됐어요', '눈이 잘 안 보여요', '귀가 아프거나 먹먹해요', '귀에서 소리가 나요'] },
];

const DURATION_OPTIONS = ['오늘부터', '1일 전부터', '2일 전부터', '3일 전부터', '4일 전부터', '5일 전부터', '6일 전부터', '일주일 이상'];

export function ChatScreen({ navigation, route }: Props) {
  const { session } = useSession();
  const { inProgressRequest, refresh: refreshTreatmentRequests } = useTreatmentRequest();
  const layout = useResponsiveLayout();
  const stacked = layout.contentWidth < 720;
  const compactHeader = layout.mobile || layout.short;
  const [showContext, setShowContext] = useState(false);
  const messageScroll = useRef<ScrollView>(null);
  const followLatest = useRef(true);
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
  const [selectedDetails, setSelectedDetails] = useState<string[]>([]);
  const [manualTriageInput, setManualTriageInput] = useState(false);
  const refreshing = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const chatRoomId = route.params.chatRoomId;
  const isWard = session?.userType === 'WARD';
  const isInstitution = session?.userType === 'INSTITUTIONS';
  const completed = room?.status === 'COMPLETED' || Boolean(summary);
  const treatmentLocked = !completed && (room?.status === 'IN_PROGRESS' || inProgressRequest?.chatRoomId === chatRoomId);
  const wardMessages = messages.filter((message) => message.senderType === 'WARD_USER');
  const triageStep: TriageStep = wardMessages.length === 0
    ? 'MAIN_SYMPTOM'
    : wardMessages.length === 1
      ? 'DETAIL_SYMPTOMS'
      : wardMessages.length === 2
        ? 'DURATION'
        : 'COMPLETE';
  const selectedMainSymptom = MAIN_SYMPTOM_OPTIONS.find((option) => option.label === wardMessages[0]?.content);
  const triageInProgress = Boolean(isWard && !completed && triageStep !== 'COMPLETE');
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
    setSelectedDetails([]);
    setManualTriageInput(false);
    setContent('');
  }, [chatRoomId]);

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

  async function sendChatContent(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue || !isWard || sending || completed) return false;
    setSending(true);
    setError(null);
    try {
      const message = await teamApi.sendWardMessage(chatRoomId, trimmedValue);
      setMessages((current) => current.some((item) => item.messageId === message.messageId)
        ? current
        : [...current, message]);
      setContent('');
      setManualTriageInput(false);
      followLatest.current = true;
      return true;
    } catch (caught) {
      setError(readableError(caught));
      return false;
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    const sent = await sendChatContent(content);
    if (sent && triageStep === 'DETAIL_SYMPTOMS') setSelectedDetails([]);
  }

  async function selectMainSymptom(value: string) {
    await sendChatContent(value);
  }

  function toggleDetailSymptom(value: string) {
    setSelectedDetails((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  async function submitDetailSymptoms() {
    if (!selectedDetails.length) return;
    const sent = await sendChatContent(selectedDetails.join(', '));
    if (sent) setSelectedDetails([]);
  }

  async function selectDuration(value: string) {
    await sendChatContent(value === '일주일 이상' ? '일주일 이상 아팠어요' : `${value} 아팠어요`);
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
    <Screen scrollable={false} contentStyle={styles.screen}>
      {compactHeader ? <View style={styles.compactHeader}>
        <Text numberOfLines={2} style={styles.compactTitle}>{participantName ? `${participantName}님과의 진료` : '진료 대화'}</Text>
        <Button title="새로고침" compact tone="secondary" onPress={() => refresh()} disabled={loading} />
      </View> : <PageHeader
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
      />}

      {error ? <Notice tone="error" title="대화를 처리하지 못했습니다.">{error}</Notice> : null}
      {completed ? (
        <Notice tone="success" title="진료가 종료되었습니다.">
          추가 메시지와 녹음은 제한되며 완료된 기록은 아카이브에서 확인할 수 있습니다.
        </Notice>
      ) : null}

      {stacked && completed ? <View style={styles.chatTabs}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: !showContext }} onPress={() => setShowContext(false)} style={[styles.chatTab, !showContext && styles.chatTabActive]}><Text style={styles.chatTabText}>대화</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: showContext }} onPress={() => setShowContext(true)} style={[styles.chatTab, showContext && styles.chatTabActive]}><Text style={styles.chatTabText}>진료 정보 · 요약</Text></Pressable>
      </View> : null}
      <View style={[styles.chatLayout, stacked && styles.chatLayoutStacked]}>
        <View style={[styles.transcriptColumn, stacked && styles.transcriptColumnStacked, stacked && completed && showContext && { display: 'none' }]}>
          <View style={styles.transcriptHeader}>
            <View>
              <Text style={styles.columnEyebrow}>CONVERSATION</Text>
              <Text style={styles.columnTitle}>진료 대화</Text>
            </View>
            <StatusBadge label={`${messages.length}개 메시지`} tone="primary" />
          </View>

          <ScrollView ref={messageScroll} testID="chat-messages" style={styles.messageArea}
            contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled"
            scrollEventThrottle={80}
            onScroll={({ nativeEvent: e }) => { followLatest.current = e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y < 64; }}
            onLayout={() => { if (followLatest.current) messageScroll.current?.scrollToEnd({ animated: false }); }}
            onContentSizeChange={() => { if (followLatest.current) messageScroll.current?.scrollToEnd({ animated: false }); }}>
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
          </ScrollView>

          {!completed && isWard ? (
            <ScrollView
              testID="chat-composer"
              style={[styles.composerScroll, { maxHeight: triageInProgress ? (layout.mobile ? Math.min(520, Math.max(360, layout.height * 0.62)) : layout.short ? 260 : 400) : (layout.short ? 200 : 220) }]}
              contentContainerStyle={styles.composer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {triageStep !== 'COMPLETE' ? (
                <TriagePanel
                  mobile={layout.mobile}
                  step={triageStep}
                  selectedMainSymptom={selectedMainSymptom}
                  selectedDetails={selectedDetails}
                  sending={sending}
                  manualInputOpen={manualTriageInput}
                  onSelectMain={(value) => { void selectMainSymptom(value); }}
                  onToggleDetail={toggleDetailSymptom}
                  onSubmitDetails={() => { void submitDetailSymptoms(); }}
                  onSelectDuration={(value) => { void selectDuration(value); }}
                  onContinueWithChat={() => setManualTriageInput(true)}
                />
              ) : null}

              {!triageInProgress || manualTriageInput ? (
                <>
                  <Field
                    label={triageInProgress ? '직접 답변' : '피보호자 메시지'}
                    inputStyle={{ minHeight: 48, height: 56, maxHeight: 100 }}
                    value={content}
                    onChangeText={setContent}
                    onSubmitEditing={sendMessage}
                    multiline
                    placeholder={triageInProgress ? '현재 질문에 대한 답변을 직접 입력하세요.' : '의료진에게 전달할 내용을 입력하세요.'}
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
                        title={sending ? '전송 중…' : triageInProgress ? '답변 전송' : '메시지 전송'}
                        onPress={() => { followLatest.current = true; void sendMessage(); }}
                        disabled={sending || !content.trim()}
                      />
                    </View>
                  </View>
                </>
              ) : null}

              {!triageInProgress ? (
                <>
                  <Text style={styles.completeRevealHint}>위로 밀면 진료 종료 버튼이 나타납니다 ↓</Text>
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
                </>
              ) : null}
            </ScrollView>
          ) : null}

          {!completed && isInstitution ? (
            <ScrollView style={{ flexGrow: 0, maxHeight: layout.short ? 230 : 220 }} contentContainerStyle={[styles.recorder, { padding: 12, gap: 10 }]} keyboardShouldPersistTaps="handled">
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
            </ScrollView>
          ) : null}
        </View>

        <ScrollView style={[styles.contextColumn, stacked && styles.contextColumnStacked, stacked && (!completed || !showContext) && { display: 'none' }]}
          contentContainerStyle={{ gap: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
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


        </ScrollView>
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

function TriagePanel({
  mobile,
  step,
  selectedMainSymptom,
  selectedDetails,
  sending,
  manualInputOpen,
  onSelectMain,
  onToggleDetail,
  onSubmitDetails,
  onSelectDuration,
  onContinueWithChat,
}: {
  mobile: boolean;
  step: Exclude<TriageStep, 'COMPLETE'>;
  selectedMainSymptom?: MainSymptomOption;
  selectedDetails: string[];
  sending: boolean;
  manualInputOpen: boolean;
  onSelectMain: (value: string) => void;
  onToggleDetail: (value: string) => void;
  onSubmitDetails: () => void;
  onSelectDuration: (value: string) => void;
  onContinueWithChat: () => void;
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const dragResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -28) setMobileExpanded(true);
      if (gesture.dy > 28) setMobileExpanded(false);
    },
  })).current;
  const stepNumber = step === 'MAIN_SYMPTOM' ? 1 : step === 'DETAIL_SYMPTOMS' ? 2 : 3;
  const question = step === 'MAIN_SYMPTOM'
    ? '어디가 불편해서 오셨나요?'
    : step === 'DETAIL_SYMPTOMS'
      ? '어디가 어떻게 불편하신가요? 세부 증상을 알려주세요.'
      : '아픈 지 얼마나 되셨나요?';
  const helper = step === 'MAIN_SYMPTOM'
    ? '가장 가까운 증상 하나를 선택해 주세요.'
    : step === 'DETAIL_SYMPTOMS'
      ? selectedMainSymptom
        ? '해당하는 증상을 모두 선택한 뒤 답변을 전송해 주세요.'
        : '주증상을 직접 입력하셨습니다. 세부 증상도 채팅으로 직접 알려주세요.'
      : '증상이 시작된 시점을 하나 선택해 주세요.';
  const showOptions = !mobile || mobileExpanded;

  useEffect(() => {
    setMobileExpanded(false);
  }, [step]);

  return (
    <View style={[styles.triageCard, mobile && styles.triageCardMobile]} testID={`triage-step-${stepNumber}`}>
      {mobile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mobileExpanded ? '선택 목록 접기' : '선택 목록 펼치기'}
          accessibilityState={{ expanded: mobileExpanded }}
          onPress={() => setMobileExpanded((current) => !current)}
          style={styles.triageDragArea}
          {...dragResponder.panHandlers}
        >
          <View style={styles.triageDragHandle} />
          <Text style={styles.triageDragText}>{mobileExpanded ? '아래로 드래그해 목록 접기' : '위로 드래그해 선택지 보기'}</Text>
        </Pressable>
      ) : null}

      <View style={[styles.triageHeader, mobile && styles.triageHeaderMobile]}>
        <View style={[styles.triageStepBadge, mobile && styles.triageStepBadgeMobile]}>
          <Text style={styles.triageStepBadgeText}>{stepNumber}</Text>
        </View>
        <View style={styles.triageHeaderCopy}>
          <Text style={[styles.triageProgress, mobile && styles.triageProgressMobile]}>초반 문진 {stepNumber} / 3</Text>
          <Text style={[styles.triageQuestion, mobile && styles.triageQuestionMobile]}>{question}</Text>
          <Text style={[styles.triageHelper, mobile && styles.triageHelperMobile]}>{helper}</Text>
        </View>
      </View>

      {showOptions && step === 'MAIN_SYMPTOM' ? (
        <View style={[styles.triageOptions, mobile && styles.triageOptionsMobile]}>
          {MAIN_SYMPTOM_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="radio"
              accessibilityState={{ disabled: sending }}
              disabled={sending}
              onPress={() => onSelectMain(option.label)}
              style={({ pressed }) => [styles.triageOption, mobile && styles.triageOptionMobile, pressed && styles.triageOptionPressed]}
            >
              <View style={styles.triageOptionMarker} />
              <Text style={[styles.triageOptionText, mobile && styles.triageOptionTextMobile]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showOptions && step === 'DETAIL_SYMPTOMS' && selectedMainSymptom ? (
        <>
          <View style={[styles.triageOptions, mobile && styles.triageOptionsMobile]}>
            {selectedMainSymptom.details.map((detail) => {
              const selected = selectedDetails.includes(detail);
              return (
                <Pressable
                  key={detail}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled: sending }}
                  disabled={sending}
                  onPress={() => onToggleDetail(detail)}
                  style={({ pressed }) => [
                    styles.triageOption,
                    mobile && styles.triageOptionMobile,
                    selected && styles.triageOptionSelected,
                    pressed && styles.triageOptionPressed,
                  ]}
                >
                  <View style={[styles.triageCheck, selected && styles.triageCheckSelected]}>
                    <Text style={styles.triageCheckText}>{selected ? '✓' : ''}</Text>
                  </View>
                  <Text style={[styles.triageOptionText, mobile && styles.triageOptionTextMobile, selected && styles.triageOptionTextSelected]}>{detail}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            title={selectedDetails.length ? `선택한 증상 ${selectedDetails.length}개 전송` : '세부 증상을 선택해 주세요'}
            onPress={onSubmitDetails}
            disabled={sending || !selectedDetails.length}
          />
        </>
      ) : null}

      {showOptions && step === 'DURATION' ? (
        <View style={[styles.triageOptions, mobile && styles.triageOptionsMobile]}>
          {DURATION_OPTIONS.map((duration) => (
            <Pressable
              key={duration}
              accessibilityRole="radio"
              accessibilityState={{ disabled: sending }}
              disabled={sending}
              onPress={() => onSelectDuration(duration)}
              style={({ pressed }) => [styles.triageOption, mobile && styles.triageOptionMobile, pressed && styles.triageOptionPressed]}
            >
              <View style={styles.triageOptionMarker} />
              <Text style={[styles.triageOptionText, mobile && styles.triageOptionTextMobile]}>{duration}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showOptions ? <View style={styles.triageChatAction}>
        <Text style={[styles.triageChatHint, mobile && styles.triageChatHintMobile]}>목록에 없거나 직접 설명하고 싶다면 채팅으로 답변할 수 있습니다.</Text>
        <Button
          title="채팅으로 계속하기"
          tone="secondary"
          onPress={onContinueWithChat}
          disabled={sending || manualInputOpen}
        />
      </View> : null}
    </View>
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

      <View style={styles.recordActions}>
        <Button title="진료 시작하기" onPress={autoVoice.start} disabled={!autoVoice.supported || !canStart} />
        <Button title="자동 녹음 종료" tone="secondary" onPress={() => autoVoice.stop(true)} disabled={canStart || autoVoice.captureState === 'COMPLETED'} />
        {failedCount ? <Button title="실패 조각 다시 전송" tone="ghost" onPress={autoVoice.retryFailed} /> : null}
      </View>

      <View style={[styles.meterCard, { padding: 10, gap: 6 }]}>
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
        
      </View>

      {!autoVoice.supported ? <Notice tone="error">현재 브라우저는 자동 발화 녹음을 지원하지 않습니다.</Notice> : null}
      {autoVoice.error ? <Notice tone="error" title="자동 녹음을 확인해 주세요.">{autoVoice.error}</Notice> : null}



      <Text style={styles.completeRevealHint}>음성 변환 대기는 아래로 스크롤해 확인하세요 ↓</Text>
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
  compactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  compactTitle: { flex: 1, minWidth: 0, color: colors.text, fontFamily, fontSize: 18, fontWeight: '800' },
  chatTabs: { flexDirection: 'row', gap: 8 },
  chatTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.surface },
  chatTabActive: { backgroundColor: colors.primarySoft },
  chatTabText: { color: colors.primary, fontFamily, fontSize: 14, fontWeight: '800' },
  screen: { maxWidth: 1540, flex: 1, minHeight: 0, padding: 12, paddingBottom: 12, paddingTop: 12, gap: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatLayout: { flex: 1, minHeight: 0, width: '100%', flexDirection: 'row', alignItems: 'stretch', gap: 18 },
  chatLayoutStacked: { flexDirection: 'column', alignItems: 'stretch' },
  transcriptColumn: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  transcriptColumnStacked: { width: '100%', flex: 1, minHeight: 0 },
  contextColumn: { width: 280, minWidth: 0, minHeight: 0, flexGrow: 0 },
  contextColumnStacked: { width: '100%', flex: 1 },
  transcriptHeader: { minHeight: 52, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  columnEyebrow: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  columnTitle: { color: colors.text, fontFamily, fontSize: 19, fontWeight: '900', marginTop: 5 },
  messageArea: { flex: 1, minHeight: 0 },
  messageContent: { padding: 12, flexGrow: 1 },
  messageRow: { maxWidth: '88%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 23 },
  messageRowMine: { alignSelf: 'flex-end' },
  messageRowGrouped: { marginTop: -13 },
  senderAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  senderAvatarText: { color: colors.textSoft, fontFamily, fontSize: 13, fontWeight: '900' },
  messageBlock: { flexShrink: 1, borderRadius: 4, borderBottomRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surfaceSoft, padding: 14 },
  messageBlockMine: { borderTopRightRadius: 4, borderTopLeftRadius: radius.lg, backgroundColor: colors.primarySoft },
  messageMeta: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  messageMetaMine: { justifyContent: 'flex-end' },
  senderName: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  messageTime: { color: colors.faint, fontFamily, fontSize: 10 },
  messageText: { color: colors.textSoft, fontFamily, fontSize: 15, lineHeight: 22 },
  recordMeta: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '800', marginTop: 8 },
  composerScroll: { flexGrow: 0, flexShrink: 0, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.canvas },
  composer: { padding: 12, gap: 8 },
  completeRevealHint: { color: colors.muted, fontFamily, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  composerHint: { display: 'none', flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  composerHintIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primarySoft, color: colors.primary, fontFamily, fontSize: 11, fontWeight: '900', textAlign: 'center', lineHeight: 20 },
  composerHintText: { color: colors.muted, fontFamily, fontSize: 11 },
  sendButton: { minWidth: 0, width: '100%' },
  triageCard: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 16, gap: 14 },
  triageCardMobile: { borderRadius: 22, paddingTop: 9, paddingHorizontal: 14, paddingBottom: 16, gap: 16 },
  triageDragArea: { minHeight: 38, alignItems: 'center', justifyContent: 'center', gap: 7 },
  triageDragHandle: { width: 48, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  triageDragText: { color: colors.primary, fontFamily, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  triageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  triageHeaderMobile: { gap: 13, paddingHorizontal: 2 },
  triageStepBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  triageStepBadgeMobile: { width: 38, height: 38, borderRadius: 19 },
  triageStepBadgeText: { color: colors.surface, fontFamily, fontSize: 15, fontWeight: '900' },
  triageHeaderCopy: { flex: 1, minWidth: 0 },
  triageProgress: { color: colors.primary, fontFamily, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  triageProgressMobile: { fontSize: 13, lineHeight: 18 },
  triageQuestion: { color: colors.text, fontFamily, fontSize: 18, lineHeight: 25, fontWeight: '900', marginTop: 4 },
  triageQuestionMobile: { fontSize: 21, lineHeight: 29, letterSpacing: -0.6, marginTop: 5 },
  triageHelper: { color: colors.muted, fontFamily, fontSize: 12, lineHeight: 18, marginTop: 5 },
  triageHelperMobile: { fontSize: 15, lineHeight: 22, marginTop: 7 },
  triageOptions: { flexDirection: 'column', flexWrap: 'nowrap', gap: 9 },
  triageOptionsMobile: { flexDirection: 'column', flexWrap: 'nowrap', gap: 9 },
  triageOption: { width: '100%', minHeight: 54, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 15, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  triageOptionMobile: { width: '100%', minHeight: 56, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 14, gap: 11 },
  triageOptionPressed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  triageOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  triageOptionMarker: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  triageOptionText: { flex: 1, color: colors.textSoft, fontFamily, fontSize: 15, lineHeight: 22, fontWeight: '800' },
  triageOptionTextMobile: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  triageOptionTextSelected: { color: colors.primaryDark, fontWeight: '900' },
  triageCheck: { width: 18, height: 18, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 6, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  triageCheckSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  triageCheckText: { color: colors.surface, fontFamily, fontSize: 13, lineHeight: 17, fontWeight: '900' },
  triageChatAction: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 9 },
  triageChatHint: { color: colors.muted, fontFamily, fontSize: 11, lineHeight: 17 },
  triageChatHintMobile: { fontSize: 15, lineHeight: 22 },
  recorder: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.canvas, padding: 19, gap: 13 },
  recorderHeader: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  recordDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.faint },
  recordDotActive: { backgroundColor: colors.danger },
  recorderCopy: { flex: 1 },
  recorderTitle: { color: colors.text, fontFamily, fontSize: 13, fontWeight: '900' },
  autoRecorderHeader: { paddingVertical: 11, paddingHorizontal: 13 },
  autoRecorderTitle: { color: colors.text, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  recorderText: { color: colors.muted, fontFamily, fontSize: 11, lineHeight: 17, marginTop: 4 },
  recordActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meterCard: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: 13, gap: 8 },
  meterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meterLabel: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  meterValue: { color: colors.primary, fontFamily, fontSize: 11, fontWeight: '900' },
  meterTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  meterHint: { color: colors.muted, fontFamily, fontSize: 10, lineHeight: 15 },
  queueCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 13, gap: 9 },
  queueHeader: { gap: 3 },
  queueTitle: { color: colors.text, fontFamily, fontSize: 12, fontWeight: '900' },
  queueDescription: { color: colors.muted, fontFamily, fontSize: 10, lineHeight: 15 },
  queueRow: { minHeight: 45, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 9 },
  queueSequence: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  queueSequenceText: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  queueCopy: { flex: 1 },
  queueItemTitle: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  queueItemText: { color: colors.muted, fontFamily, fontSize: 10, lineHeight: 15, marginTop: 2 },
  queueEmpty: { borderTopWidth: 1, borderTopColor: colors.border, color: colors.muted, fontFamily, fontSize: 10, lineHeight: 16, paddingTop: 9 },
  sessionCard: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 21 },
  sessionTitle: { color: colors.text, fontFamily, fontSize: 18, fontWeight: '900', marginTop: 6, marginBottom: 15 },
  infoRow: { minHeight: 40, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  infoLabel: { color: colors.muted, fontFamily, fontSize: 11, fontWeight: '800' },
  infoValue: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  summaryPanel: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.primarySoft, padding: 20, gap: 10 },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  summaryTitle: { color: colors.text, fontFamily, fontSize: 18, fontWeight: '900', marginTop: 6 },
  summaryItem: { borderRadius: radius.md, backgroundColor: colors.surface, padding: 14 },
  summaryItemTitle: { color: colors.primary, fontFamily, fontSize: 11, fontWeight: '900' },
  summaryItemText: { color: colors.textSoft, fontFamily, fontSize: 12, lineHeight: 19, marginTop: 6 },
  guidePanel: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 21 },
  guideTitle: { color: colors.text, fontFamily, fontSize: 17, fontWeight: '900', marginTop: 6, marginBottom: 13 },
  guideRow: { minHeight: 58, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  guideNumber: { color: colors.primary, fontFamily, fontSize: 11, fontWeight: '900' },
  guideText: { flex: 1, color: colors.textSoft, fontFamily, fontSize: 12, lineHeight: 18 },
  completeCard: { flexShrink: 0, minWidth: 0, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, backgroundColor: colors.primarySoft, padding: 21, gap: 10 },
  completeTitle: { color: colors.text, fontFamily, fontSize: 16, fontWeight: '900' },
  completeText: { color: colors.textSoft, fontFamily, fontSize: 11, lineHeight: 18, marginBottom: 6 },
});
