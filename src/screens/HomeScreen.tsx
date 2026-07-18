import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import { ActionCard, Notice, Screen, uiStyles } from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const roleLabel = {
  WARD: '환자',
  GUARDIAN: '보호자',
  INSTITUTIONS: '의료기관',
} as const;

export function HomeScreen({ navigation }: Props) {
  const { session } = useSession();
  if (!session) return null;

  return (
    <Screen>
      <Text style={uiStyles.pageTitle}>
        {roleLabel[session.userType]} {session.userId}님
      </Text>
      <Text style={uiStyles.subtitle}>오늘 필요한 메뉴를 선택하세요.</Text>

      {session.userType === 'WARD' ? (
        <>
          <ActionCard
            title="새 진료 요청"
            description="의료기관을 찾아 온라인 진료를 요청합니다."
            meta="의료기관 검색부터 시작"
            onPress={() => navigation.navigate('InstitutionSearch')}
          />
          <ActionCard
            title="진료 요청 현황"
            description="보낸 요청의 수락 여부를 확인하고 진료를 시작합니다."
            onPress={() => navigation.navigate('RequestList')}
          />
          <ActionCard
            title="진료 기록"
            description="종료된 진료의 대화와 요약을 확인합니다."
            onPress={() => navigation.navigate('ArchiveList')}
          />
          <ActionCard
            title="보호자 연결"
            description="보호자 연결 요청을 확인합니다."
            onPress={() => navigation.navigate('Care')}
          />
        </>
      ) : null}

      {session.userType === 'INSTITUTIONS' ? (
        <>
          <ActionCard
            title="들어온 진료 요청"
            description="환자의 요청을 확인하고 수락 또는 거절합니다."
            onPress={() => navigation.navigate('RequestList')}
          />
          <ActionCard
            title="진료 대화방 입장"
            description="진료가 시작된 채팅방에서 음성으로 답변합니다."
            meta="현재는 채팅방 번호 필요"
            onPress={() => navigation.navigate('RequestList')}
          />
          <Notice tone="warning">
            의료기관용 채팅방 목록 API가 아직 없어 요청 화면에서 채팅방 번호로 입장합니다.
          </Notice>
        </>
      ) : null}

      {session.userType === 'GUARDIAN' ? (
        <>
          <ActionCard
            title="환자 찾기·연결 신청"
            description="보호할 환자를 아이디로 검색하고 연결을 요청합니다."
            onPress={() => navigation.navigate('Care')}
          />
          <ActionCard
            title="연결 현황"
            description="신청한 보호자 연결의 상태를 확인합니다."
            onPress={() => navigation.navigate('Care')}
          />
          <Notice>
            보호자용 진료 기록 목록은 백엔드 API가 추가되면 이 홈에 바로 연결할 수 있습니다.
          </Notice>
        </>
      ) : null}

      <ActionCard
        title="설정"
        description="계정, 로그아웃, 서버 연결 상태를 관리합니다."
        onPress={() => navigation.navigate('Settings')}
      />
    </Screen>
  );
}
