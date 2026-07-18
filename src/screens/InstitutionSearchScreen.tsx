import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Button, EmptyState, Field, Notice, Screen, Section, uiStyles } from '../components/Ui';
import { RootStackParamList } from '../navigation';
import { colors, spacing } from '../theme/theme';
import { Institution } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'InstitutionSearch'>;

export function InstitutionSearchScreen({ navigation }: Props) {
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      setItems((await teamApi.searchInstitutions(keyword.trim())) ?? []);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search();
  }, []);

  async function request(institution: Institution) {
    setLoading(true);
    setError(null);
    try {
      await teamApi.createMedicalRequest(institution.institutionUserId);
      setSentTo(institution.name);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>의료기관 찾기</Text>
      <Text style={uiStyles.subtitle}>진료를 요청할 의료기관을 선택하세요.</Text>
      <Section title="검색">
        <Field
          label="기관 이름 또는 아이디"
          value={keyword}
          onChangeText={setKeyword}
          placeholder="비워두면 전체 기관"
          onSubmitEditing={search}
        />
        <Button title={loading ? '검색 중...' : '검색'} onPress={search} disabled={loading} />
      </Section>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {sentTo ? (
        <Notice>
          {sentTo}에 진료 요청을 보냈습니다. 기관이 수락하면 진료를 시작할 수 있습니다.
        </Notice>
      ) : null}
      <Section title={`검색 결과 ${items.length}곳`}>
        {items.length === 0 && !loading ? (
          <EmptyState>검색된 의료기관이 없습니다.</EmptyState>
        ) : (
          items.map((item) => (
            <View key={item.institutionUserId} style={styles.card}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={uiStyles.subtitle}>{item.institutionUserId}</Text>
              <Text style={uiStyles.subtitle}>{item.email}</Text>
              <Button
                title={sentTo === item.name ? '요청 완료' : '진료 요청'}
                onPress={() => request(item)}
                disabled={loading || sentTo === item.name}
              />
            </View>
          ))
        )}
      </Section>
      <Button
        title="내 요청 현황 보기"
        tone="secondary"
        onPress={() => navigation.navigate('RequestList')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#fbfcfe',
    padding: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
});
