import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { Notice, Screen, Section, uiStyles } from '../components/Ui';
import { RootStackParamList } from '../navigation';
import { ArchiveDetail } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchiveDetail'>;

export function ArchiveDetailScreen({ route }: Props) {
  const [archive, setArchive] = useState<ArchiveDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    teamApi
      .getArchive(route.params.archiveId)
      .then(setArchive)
      .catch((caught) => setError(readableError(caught)));
  }, [route.params.archiveId]);

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>{archive?.title || '진료 기록 불러오는 중'}</Text>
      <Text style={uiStyles.subtitle}>
        {archive ? formatDate(archive.archiveDate) : `기록 #${route.params.archiveId}`}
      </Text>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {archive ? (
        <>
          <Section title="진료 요약">
            <Text selectable style={uiStyles.subtitle}>
              {archive.text || '저장된 요약이 없습니다.'}
            </Text>
          </Section>
          <Section title="전체 대화">
            <Text selectable style={uiStyles.subtitle}>
              {archive.allChatText || '저장된 대화가 없습니다.'}
            </Text>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
