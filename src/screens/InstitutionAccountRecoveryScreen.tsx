import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Notice, Screen } from '../components/Ui';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'InstitutionAccountRecovery'>;

export function InstitutionAccountRecoveryScreen({ navigation }: Props) {
  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>INSTITUTION ACCOUNT RECOVERY</Text>
        <Text style={styles.title}>기관 계정 찾기 기능을 준비하고 있습니다.</Text>
        <Text style={styles.description}>
          기관 계정 복구 기능이 제공되기 전까지는 관리자에게 문의해 주세요.
        </Text>
        <Notice title="아직 사용할 수 없는 기능입니다.">
          기관 계정 복구 API가 준비되면 이 화면에서 아이디 찾기와 비밀번호 재설정을 지원할 예정입니다.
        </Notice>
        <Button
          title="기관 로그인으로 돌아가기"
          onPress={() => navigation.navigate('Login', { kind: 'INSTITUTION' })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    maxWidth: 720,
    paddingTop: 80,
  },
  card: {
    gap: spacing.lg,
    padding: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    color: colors.text,
    fontFamily,
    fontSize: 25,
    lineHeight: 35,
    fontWeight: '900',
  },
  description: {
    color: colors.muted,
    fontFamily,
    fontSize: 12,
    lineHeight: 21,
  },
});
