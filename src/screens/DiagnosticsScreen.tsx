import { Text, View } from 'react-native';

import { API_BASE_URL } from '../api/client';
import { clearDiagnostics, useDiagnostics } from '../api/diagnostics';
import { Button, Screen, Section, uiStyles } from '../components/Ui';

export function DiagnosticsScreen() {
  const entries = useDiagnostics();

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>API 진단 로그</Text>
      <Text style={uiStyles.subtitle}>서버: {API_BASE_URL}</Text>
      <Text style={uiStyles.subtitle}>
        요청 본문, 토큰, 음성 및 대화 전문은 저장하지 않습니다. 최근 100건만 메모리에 유지합니다.
      </Text>
      <Button title="로그 비우기" tone="danger" onPress={clearDiagnostics} />
      {entries.length === 0 ? (
        <Section title="기록 없음">
          <Text style={uiStyles.subtitle}>기능 화면에서 API를 호출하면 여기에 표시됩니다.</Text>
        </Section>
      ) : (
        entries.map((entry) => (
          <Section
            key={entry.id}
            title={`${entry.ok ? '성공' : '실패'} · ${entry.method} ${entry.path}`}
          >
            <View style={uiStyles.row}>
              <Text style={uiStyles.badge}>HTTP {entry.status ?? 'NETWORK'}</Text>
              <Text style={uiStyles.badge}>{entry.durationMs}ms</Text>
            </View>
            <Text selectable style={uiStyles.subtitle}>
              Request ID: {entry.requestId}
            </Text>
            <Text style={uiStyles.subtitle}>{entry.at}</Text>
            {entry.message ? <Text style={uiStyles.subtitle}>{entry.message}</Text> : null}
          </Section>
        ))
      )}
    </Screen>
  );
}
