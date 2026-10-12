import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import { LoadingState, Screen } from '../components/Ui';
import { useResponsiveLayout } from '../components/Responsive';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius } from '../theme/theme';
import { TextTalkProfile } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'HospitalReception'>;

export function HospitalReceptionScreen({ navigation }: Props) {
  const { session } = useSession();
  const layout = useResponsiveLayout();
  const [profile, setProfile] = useState<TextTalkProfile | null>(null);
  const [firstVisit, setFirstVisit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);

  const load = useCallback(async () => {
    if (session?.userType !== 'WARD') return;
    setLoading(true);
    setError(null);
    try {
      setProfile(await teamApi.getTextTalkProfile(session.accessToken));
    } catch (caught) {
      setError(readableError(caught));
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, session?.userType]);

  useEffect(() => {
    if (session && session.userType !== 'WARD') {
      navigation.replace('Home');
      return;
    }
    void load();
  }, [load, navigation, session]);

  if (!session || session.userType !== 'WARD') return null;

  const birthDate = formatBirthDate(profile?.wardUserBirthDate);
  const missingProfileData = !profile?.wardUserBirthDate;
  const visitSentence = firstVisit
    ? '처음 이 병원에 방문했습니다.'
    : '이 병원에 방문한 적이 있습니다.';

  return (
    <Screen contentStyle={[styles.screen, layout.mobile && styles.screenMobile]}>
      <Modal animationType="fade" onRequestClose={() => setAlertVisible(false)} transparent visible={alertVisible}>
        <View style={styles.alertOverlay}>
          <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.alertDialog}>
            <View style={styles.alertIcon}><Text style={styles.alertIconText}>!</Text></View>
            <Text style={styles.alertTitle}>사용자 정보를 확인하지 못했습니다.</Text>
            <Text style={styles.alertDescription}>잠시 후 다시 시도해 주세요.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAlertVisible(false)}
              style={({ pressed }) => [styles.alertButton, pressed && styles.alertButtonPressed]}
            >
              <Text style={styles.alertButtonText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {loading ? (
        <View style={styles.loadingCard}>
          <LoadingState label="사용자 정보를 확인하고 있습니다." />
        </View>
      ) : (
        <View style={[styles.paper, layout.mobile && styles.paperMobile]}>
          <View style={styles.paperHeader}>
            <View style={styles.paperHeading}>
              <Text style={styles.paperLabel}>병원 접수 필담</Text>
              <Text style={[styles.paperGuide, layout.mobile && styles.paperGuideMobile]}>접수원에게 이 화면을 보여주세요.</Text>
            </View>
            <View accessibilityRole="radiogroup" style={[styles.visitToggle, layout.mobile && styles.visitToggleMobile]}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: firstVisit }}
                onPress={() => setFirstVisit(true)}
                style={({ pressed }) => [styles.visitOption, firstVisit && styles.visitOptionActive, pressed && styles.visitOptionPressed]}
              >
                <Text style={[styles.visitOptionText, firstVisit && styles.visitOptionTextActive]}>처음 방문했어요</Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: !firstVisit }}
                onPress={() => setFirstVisit(false)}
                style={({ pressed }) => [styles.visitOption, !firstVisit && styles.visitOptionActive, pressed && styles.visitOptionPressed]}
              >
                <Text style={[styles.visitOptionText, !firstVisit && styles.visitOptionTextActive]}>이 병원에 방문한 적 있어요</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.infoStrip}>
            <Text style={styles.infoText}>해당 화면은 농인이 병원 접수를 위해 활용하는 필담 화면입니다.</Text>
          </View>

          <View style={[styles.messageBox, layout.mobile && styles.messageBoxMobile]}>
            <Text style={[styles.messageLine, layout.mobile && styles.messageLineMobile]}>
              안녕하세요. 저는 <Text style={styles.emphasis}>{profile?.wardUserName || '이름 확인 필요'}</Text>입니다.
            </Text>
            <Text style={[styles.messageLine, layout.mobile && styles.messageLineMobile]}>
              생년월일은 <Text style={styles.emphasis}>{birthDate || '확인 필요'}</Text>입니다.
            </Text>
            <View style={styles.messageGap} />
            <Text style={[styles.visitLine, layout.mobile && styles.visitLineMobile]}>{visitSentence}</Text>
            <View style={styles.messageGap} />
            <Text style={[styles.messageLine, layout.mobile && styles.messageLineMobile]}>증상은 진료실에서 말씀드리겠습니다.</Text>
          </View>

          {firstVisit ? (
            <View style={[styles.identificationBox, layout.mobile && styles.identificationBoxMobile]}>
              <Text style={[styles.identificationText, layout.mobile && styles.identificationTextMobile]}>접수원에게 신분증을 제시해주세요!!</Text>
            </View>
          ) : null}

          {missingProfileData && !error ? (
            <Text style={styles.dataHint}>생년월일이 계정 응답에 없어 확인이 필요합니다.</Text>
          ) : null}

          {error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.alertButtonPressed]}
            >
              <Text style={styles.retryButtonText}>정보 다시 불러오기</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function formatBirthDate(value?: string | null) {
  if (!value) return null;
  const parts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (parts) return `${Number(parts[1])}년 ${Number(parts[2])}월 ${Number(parts[3])}일`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { width: '100%', maxWidth: 1120, paddingTop: 18, paddingBottom: 42 },
  screenMobile: { paddingTop: 8, paddingBottom: 24 },
  loadingCard: { minHeight: 420, borderWidth: 2, borderColor: colors.text, borderRadius: radius.sm, backgroundColor: '#fffef9' },
  paper: { width: '100%', borderWidth: 1, borderColor: '#d9ddd9', borderRadius: 2, backgroundColor: '#fffef9', padding: 36, gap: 28 },
  paperMobile: { padding: 18, gap: 18 },
  paperHeader: { gap: 20 },
  paperHeading: { gap: 2 },
  paperLabel: { color: colors.text, fontFamily, fontSize: 18, lineHeight: 25, fontWeight: '900' },
  paperGuide: { color: colors.muted, fontFamily, fontSize: 15, lineHeight: 22, marginTop: 5 },
  paperGuideMobile: { fontSize: 14, lineHeight: 20 },
  visitToggle: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  visitToggleMobile: { gap: 9 },
  visitOption: { minHeight: 54, borderWidth: 2, borderColor: colors.borderStrong, borderRadius: radius.pill, backgroundColor: '#ffffff', paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  visitOptionActive: { borderColor: colors.primaryDark, backgroundColor: colors.primary },
  visitOptionPressed: { opacity: 0.78 },
  visitOptionText: { color: colors.text, fontFamily, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  visitOptionTextActive: { color: '#ffffff' },
  infoStrip: { borderLeftWidth: 4, borderLeftColor: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 18, paddingVertical: 14 },
  infoText: { color: colors.text, fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  alertOverlay: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', backgroundColor: 'rgba(15, 23, 42, 0.28)', paddingHorizontal: 20, paddingTop: 96 },
  alertDialog: { width: '100%', maxWidth: 420, borderRadius: 20, backgroundColor: '#ffffff', paddingHorizontal: 26, paddingVertical: 26, alignItems: 'center', shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  alertIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf2ff' },
  alertIconText: { color: '#2563eb', fontFamily, fontSize: 25, lineHeight: 30, fontWeight: '900' },
  alertTitle: { color: colors.text, fontFamily, fontSize: 20, lineHeight: 28, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  alertDescription: { color: colors.muted, fontFamily, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 7 },
  alertButton: { width: '100%', minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', marginTop: 22 },
  alertButtonPressed: { opacity: 0.8 },
  alertButtonText: { color: '#ffffff', fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  retryButton: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', paddingHorizontal: 24, alignSelf: 'center' },
  retryButtonText: { color: '#ffffff', fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  messageBox: { minHeight: 420, borderWidth: 3, borderColor: colors.text, borderRadius: 10, backgroundColor: '#ffffff', paddingHorizontal: 44, paddingVertical: 42, justifyContent: 'center' },
  messageBoxMobile: { minHeight: 390, borderWidth: 2, paddingHorizontal: 21, paddingVertical: 28 },
  messageLine: { color: colors.text, fontFamily, fontSize: 28, lineHeight: 45, fontWeight: '700', letterSpacing: -0.5 },
  messageLineMobile: { fontSize: 21, lineHeight: 35, letterSpacing: -0.3 },
  emphasis: { color: colors.text, fontWeight: '900', textDecorationLine: 'underline', textDecorationColor: colors.primary },
  messageGap: { height: 23 },
  visitLine: { color: colors.text, fontFamily, fontSize: 31, lineHeight: 45, fontWeight: '900', letterSpacing: -0.7 },
  visitLineMobile: { fontSize: 23, lineHeight: 35, letterSpacing: -0.3 },
  identificationBox: { minHeight: 142, borderWidth: 3, borderColor: colors.text, borderRadius: 10, backgroundColor: '#ffffff', paddingHorizontal: 32, paddingVertical: 26, alignItems: 'center', justifyContent: 'center' },
  identificationBoxMobile: { minHeight: 118, borderWidth: 2, paddingHorizontal: 19, paddingVertical: 21 },
  identificationText: { color: colors.text, fontFamily, fontSize: 32, lineHeight: 44, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8 },
  identificationTextMobile: { fontSize: 23, lineHeight: 34, letterSpacing: -0.3 },
  dataHint: { color: colors.muted, fontFamily, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
