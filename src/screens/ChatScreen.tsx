import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Button, Field, Screen, Section, uiStyles } from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, spacing } from '../theme/theme';
import { ChatMessage } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ route, navigation }: Props) {
  const { session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshingRef = useRef(false);
  const chatRoomId = route.params.chatRoomId;
  const isWard = session?.userType === 'WARD';
  const isInstitution = session?.userType === 'INSTITUTIONS';

  const refresh = useCallback(
    async (silent = false) => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      if (!silent) setLoading(true);
      try {
        const result = isInstitution
          ? await teamApi.getInstitutionMessages(chatRoomId)
          : await teamApi.getWardMessages(chatRoomId);
        setMessages(result ?? []);
        setError(null);
      } catch (caught) {
        setError(readableError(caught));
      } finally {
        refreshingRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [chatRoomId, isInstitution],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => refresh(true), 2000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  async function send() {
    if (!content.trim() || !isWard) return;
    setLoading(true);
    try {
      await teamApi.sendWardMessage(chatRoomId, content.trim());
      setContent('');
      await refresh(true);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function complete() {
    setLoading(true);
    try {
      await teamApi.completeTreatment(chatRoomId);
      await refresh(true);
      setAutoRefresh(false);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>진료 채팅방 #{chatRoomId}</Text>
      <View style={uiStyles.row}>
        <Text style={uiStyles.badge}>{session?.userType}</Text>
        <Pressable onPress={() => setAutoRefresh((value) => !value)}>
          <Text style={uiStyles.badge}>
            {autoRefresh ? '● 2초 자동 갱신' : '○ 수동 갱신'}
          </Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Section
        title={`대화 ${messages.length}개`}
        description={loading ? '서버와 동기화 중...' : '서버 저장 순서대로 표시됩니다.'}
      >
        {messages.length === 0 ? (
          <Text style={uiStyles.subtitle}>아직 저장된 메시지가 없습니다.</Text>
        ) : (
          messages.map((message) => (
            <View
              key={message.messageId}
              style={[
                styles.bubble,
                message.mine ? styles.mine : styles.other,
              ]}
            >
              <Text style={styles.sender}>
                {message.mine ? '나' : message.senderName || message.senderId}
                {' · '}
                {message.messageType}
              </Text>
              <Text selectable style={styles.message}>
                {message.content}
              </Text>
              <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
            </View>
          ))
        )}
        <Button
          title={loading ? '갱신 중' : '지금 새로고침'}
          tone="secondary"
          onPress={() => refresh()}
          disabled={loading}
        />
      </Section>

      {isWard ? (
        <Section
          title="피보호자 메시지"
          description="글로 의료진에게 전달할 내용을 입력하세요."
        >
          <Field
            label="메시지"
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="의사에게 전달할 내용을 입력하세요."
          />
          <Button
            title="메시지 전송"
            onPress={send}
            disabled={loading || !content.trim()}
          />
          <Button
            title="진료 종료 및 Archive 저장"
            tone="danger"
            onPress={complete}
            disabled={loading}
          />
        </Section>
      ) : null}

      {isInstitution ? (
        <Section
          title="의료기관 음성 답변"
          description="말한 내용은 음성과 변환된 텍스트로 대화에 이어집니다."
        >
          <Button
            title="음성 녹음 화면 열기"
            onPress={() => navigation.navigate('Recording', { chatRoomId })}
          />
        </Section>
      ) : null}

      {!isWard && !isInstitution ? (
        <Section title="접근 제한">
          <Text style={uiStyles.subtitle}>보호자 계정은 진료 채팅에 참여할 수 없습니다.</Text>
        </Section>
      ) : null}
    </Screen>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString();
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '88%',
    gap: 4,
    borderRadius: 14,
    padding: 12,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primarySoft,
  },
  other: {
    alignSelf: 'flex-start',
    backgroundColor: '#edf1f6',
  },
  sender: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  message: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  time: {
    color: colors.muted,
    fontSize: 10,
  },
  error: {
    borderRadius: 10,
    backgroundColor: '#feecef',
    color: colors.danger,
    padding: spacing.md,
  },
});
