import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Platform, Text } from 'react-native';

import { teamApi } from '../api/teamApi';
import { Button, Field, ResultBox, Screen, Section, uiStyles } from '../components/Ui';
import { useAction } from '../components/useAction';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Recording'>;

export function RecordingScreen({ route, navigation }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const action = useAction();
  const [chatRoomId, setChatRoomId] = useState(
    route.params?.chatRoomId ? String(route.params.chatRoomId) : '',
  );
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function start() {
    setLocalError(null);
    setAudioUri(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setLocalError('마이크 권한이 필요합니다.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop() {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    setAudioUri(recorder.uri);
    if (!recorder.uri) setLocalError('녹음 파일 URI가 생성되지 않았습니다.');
  }

  async function upload() {
    if (!audioUri) return;
    const formData = new FormData();

    if (audioUri.startsWith('blob:')) {
      const response = await fetch(audioUri);
      const blob = await response.blob();
      formData.append('file', blob, `hearo-${Date.now()}.webm`);
    } else {
      formData.append('file', {
        uri: audioUri,
        name: `hearo-${Date.now()}.m4a`,
        type: 'audio/mp4',
      } as never);
    }

    const result = await action.run(() =>
      teamApi.uploadRecording(Number(chatRoomId), formData),
    );
    if (result && route.params?.chatRoomId) {
      navigation.goBack();
    }
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>음성 답변</Text>
      <Text style={uiStyles.subtitle}>
        답변을 짧게 나누어 녹음하면 환자의 채팅 흐름에 순서대로 이어집니다.
      </Text>
      <Section title="녹음 상태">
        <Text style={uiStyles.subtitle}>
          상태: {recorderState.isRecording ? 'RECORDING' : audioUri ? 'SAVED_LOCAL' : 'IDLE'}
        </Text>
        <Text style={uiStyles.subtitle}>
          길이: {Math.floor(recorderState.durationMillis / 1000)}초
        </Text>
        <Text selectable style={uiStyles.subtitle}>
          파일: {audioUri || '없음'}
        </Text>
        <Button title="녹음 시작" onPress={start} disabled={recorderState.isRecording} />
        <Button
          title="녹음 정지"
          tone="secondary"
          onPress={stop}
          disabled={!recorderState.isRecording}
        />
      </Section>
      <Section title="답변 전송">
        <Field
          label="Chat Room ID"
          value={chatRoomId}
          onChangeText={setChatRoomId}
          keyboardType="number-pad"
        />
        <Button
          title={action.loading ? '음성을 글로 변환 중...' : '음성 답변 전송'}
          onPress={upload}
          disabled={!audioUri || !Number(chatRoomId) || action.loading}
        />
      </Section>
      <ResultBox
        loading={action.loading}
        error={localError || action.error}
        value={action.value}
      />
    </Screen>
  );
}
