import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createElement, useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { RootStackParamList } from '../navigation';
import { colors } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MainPreview'>;

const features = [
  ['01', '진료 대화를 놓치지 않게', '의료진의 음성 답변과 환자의 대화를 한 흐름으로 안전하게 기록합니다.'],
  ['02', '핵심만 빠르게 이해하도록', '진료가 끝나면 AI가 대화의 핵심을 읽기 쉬운 기록으로 정리합니다.'],
  ['03', '가족과 함께 안심하도록', '보호자 연결을 통해 필요한 진료 기록을 함께 확인할 수 있습니다.'],
];

export function MainPreviewScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const mobile = width < 760;
  const [bannerVisible, setBannerVisible] = useState(true);
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef<{ pause: () => void; play: () => Promise<void> } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [introOffset, setIntroOffset] = useState(0);

  useEffect(() => {
    if (!videoRef.current) return;
    if (playing) {
      void videoRef.current.play().catch(() => setPlaying(false));
    } else {
      videoRef.current.pause();
    }
  }, [playing]);

  return (
    <View style={styles.page}>
      {bannerVisible ? (
        <View style={styles.banner}>
          <View style={styles.bannerMark}><Text style={styles.bannerMarkText}>O</Text></View>
          <Text style={styles.bannerText}>진료의 목소리를 이해하기 쉬운 기록으로, HearO</Text>
          <Pressable accessibilityLabel="안내 닫기" onPress={() => setBannerVisible(false)}>
            <Text style={styles.bannerClose}>×</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.header, mobile && styles.headerMobile]}>
        <Pressable
          accessibilityLabel="메인 화면으로 이동"
          accessibilityRole="link"
          onPress={() => navigation.navigate('MainPreview')}
        >
          <Image
            resizeMode="contain"
            source={require('../../assets/hearo-wordmark.png')}
            style={styles.logo}
          />
        </Pressable>
        {!mobile ? (
          <View style={styles.nav}>
            <Pressable onPress={() => scrollRef.current?.scrollTo({ y: introOffset, animated: true })}><Text style={styles.navText}>서비스 소개</Text></Pressable>
            <Pressable onPress={() => navigation.navigate('Login', { redirectTo: 'Inquiry' })}><Text style={styles.navText}>문의하기</Text></Pressable>
          </View>
        ) : null}
        <View style={styles.headerActions}>
          <Pressable style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginText}>로그인</Text>
          </Pressable>
          <Pressable style={styles.signupButton} onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.signupText}>회원가입</Text>
          </Pressable>
        </View>
      </View>
      {mobile ? (
        <View style={styles.mobilePublicNav}>
          <Pressable onPress={() => scrollRef.current?.scrollTo({ y: introOffset, animated: true })}>
            <Text style={styles.mobilePublicNavText}>서비스 소개</Text>
          </Pressable>
          <View style={styles.mobilePublicNavDivider} />
          <Pressable onPress={() => navigation.navigate('Login', { redirectTo: 'Inquiry' })}>
            <Text style={styles.mobilePublicNavText}>문의하기</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={[styles.hero, mobile && styles.heroMobile]}>
          <Text style={styles.eyebrow}>HEARO CARE NOTE</Text>
          <Text style={[styles.title, mobile && styles.titleMobile]}>
            들었던 진료를,{'\n'}보이는 안심으로.
          </Text>
          <Text style={styles.description}>
            진료실에서 오간 목소리를 기록하고, 중요한 내용을 이해하기 쉽게 정리해{'\n'}
            환자와 보호자가 같은 정보를 함께 기억하도록 돕습니다.
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.primaryButtonText}>HearO 시작하기</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.secondaryButtonText}>기존 계정으로 로그인</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.previewSection} onLayout={(event) => setIntroOffset(event.nativeEvent.layout.y)}>
          <View style={styles.previewTop}>
            <View>
              <Text style={styles.sectionKicker}>PRODUCT PREVIEW</Text>
              <Text style={styles.sectionTitle}>진료 준비부터 AI 기록까지 한곳에서</Text>
            </View>
            <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>실제 화면 미리보기</Text></View>
          </View>
          <View style={styles.videoFrame}>
            {Platform.OS === 'web'
              ? createElement('video', {
                  src: '/media/hearo-preview.m4v',
                  autoPlay: playing,
                  muted: true,
                  loop: true,
                  playsInline: true,
                  controls: true,
                  ref: videoRef,
                  'aria-label': 'HearO 서비스 화면 미리보기',
                  style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
                })
              : <View style={styles.videoFallback}><Text style={styles.videoFallbackText}>HearO 서비스 미리보기 영상</Text></View>}
          </View>
          <Pressable accessibilityRole="button" style={styles.pauseButton} onPress={() => setPlaying((value) => !value)}>
            <Text style={styles.pauseText}>{playing ? '자동 재생 중 · 일시정지' : '영상 재생'}</Text>
          </Pressable>
        </View>

        <View style={[styles.featureGrid, mobile && styles.featureGridMobile]}>
          {features.map(([number, title, copy]) => (
            <View key={number} style={styles.feature}>
              <Text style={styles.featureNumber}>{number}</Text>
              <View style={styles.featureIcon}><Text style={styles.featureIconText}>C⁝</Text></View>
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.featureCopy}>{copy}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.cta, mobile && styles.ctaMobile]}>
          <View>
            <Text style={styles.ctaKicker}>YOUR CARE, CLEARLY HEARD</Text>
            <Text style={styles.ctaTitle}>오늘의 진료부터 HearO와 함께하세요.</Text>
          </View>
          <Pressable style={styles.ctaButton} onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.ctaButtonText}>무료로 시작하기 →</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Image resizeMode="contain" source={require('../../assets/hearo-wordmark.png')} style={styles.footerLogo} />
          <Text style={styles.footerText}>청각을 시각으로 잇는 진료 기록 서비스</Text>
          <Text style={styles.footerText}>© 2026 HearO</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  banner: { minHeight: 58, paddingHorizontal: 24, backgroundColor: '#d9f3f4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bannerMark: { width: 24, height: 24, borderRadius: 7, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bannerMarkText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  bannerText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  bannerClose: { position: 'absolute', left: 24, color: colors.text, fontSize: 25, lineHeight: 26 },
  header: { height: 88, paddingHorizontal: 44, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  headerMobile: { height: 72, paddingHorizontal: 18 },
  mobilePublicNav: {
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  mobilePublicNavText: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  mobilePublicNavDivider: { width: 1, height: 12, backgroundColor: colors.border },
  logo: { width: 116, height: 42 },
  nav: { flexDirection: 'row', gap: 31, marginLeft: 55 },
  navText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', gap: 8 },
  loginButton: { minHeight: 40, paddingHorizontal: 17, borderWidth: 1, borderColor: colors.text, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  signupButton: { minHeight: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  signupText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  content: { paddingBottom: 32 },
  hero: { minHeight: 470, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#fbfcfc' },
  heroMobile: { minHeight: 430, alignItems: 'flex-start' },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 55, lineHeight: 67, letterSpacing: -2.2, fontWeight: '900', textAlign: 'center', marginTop: 17 },
  titleMobile: { fontSize: 38, lineHeight: 49, textAlign: 'left' },
  description: { maxWidth: 700, color: colors.muted, fontSize: 15, lineHeight: 25, textAlign: 'center', marginTop: 20 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 30 },
  primaryButton: { minHeight: 49, borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  secondaryButton: { minHeight: 49, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  previewSection: { width: '92%', maxWidth: 1240, alignSelf: 'center', marginTop: 40 },
  previewTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  sectionKicker: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 7 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  liveText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  videoFrame: { width: '100%', aspectRatio: 1.78, overflow: 'hidden', borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 22, backgroundColor: colors.primaryDark },
  videoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoFallbackText: { color: '#fff', fontWeight: '800' },
  pauseButton: { alignSelf: 'flex-end', paddingVertical: 10 },
  pauseText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  featureGrid: { width: '92%', maxWidth: 1240, alignSelf: 'center', flexDirection: 'row', gap: 14, paddingVertical: 70 },
  featureGridMobile: { flexDirection: 'column', paddingVertical: 40 },
  feature: { flex: 1, minHeight: 260, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 24, backgroundColor: '#fff' },
  featureNumber: { color: colors.faint, fontSize: 10, fontWeight: '900' },
  featureIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 34 },
  featureIconText: { color: colors.primary, fontSize: 19, fontWeight: '900' },
  featureTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 22 },
  featureCopy: { color: colors.muted, fontSize: 12, lineHeight: 21, marginTop: 9 },
  cta: { width: '92%', maxWidth: 1240, alignSelf: 'center', minHeight: 170, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 22, backgroundColor: colors.primarySoft, paddingHorizontal: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaMobile: { alignItems: 'flex-start', flexDirection: 'column', justifyContent: 'center', gap: 22, paddingVertical: 28, paddingHorizontal: 24 },
  ctaKicker: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  ctaTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 8 },
  ctaButton: { minHeight: 46, paddingHorizontal: 21, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  ctaButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  footer: { width: '92%', maxWidth: 1240, alignSelf: 'center', minHeight: 110, flexDirection: 'row', alignItems: 'center', gap: 22 },
  footerLogo: { width: 90, height: 35 },
  footerText: { color: colors.muted, fontSize: 10 },
});
