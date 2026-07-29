import { useNavigation, useRoute } from '@react-navigation/native';
import { PropsWithChildren, ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

import { useSession } from '../context/SessionContext';
import { UserType } from '../types/api';
import { colors, fontFamily, radius, spacing } from '../theme/theme';

type NavItem = {
  route: string;
  icon: string;
  label: string;
};

const roleNavigation: Record<UserType, NavItem[]> = {
  WARD: [
    { route: 'Home', icon: '⌂', label: '홈' },
    { route: 'InstitutionSearch', icon: '＋', label: '진료 요청' },
    { route: 'RequestList', icon: '↗', label: '요청 현황' },
    { route: 'ArchiveList', icon: '▤', label: '진료 기록' },
    { route: 'Care', icon: '♡', label: '케어 연결' },
    { route: 'Inquiry', icon: '?', label: '문의하기' },
  ],
  GUARDIAN: [
    { route: 'Home', icon: '⌂', label: '홈' },
    { route: 'Care', icon: '♡', label: '케어 연결' },
    { route: 'ArchiveList', icon: '▤', label: '진료 기록' },
    { route: 'Inquiry', icon: '?', label: '문의하기' },
  ],
  INSTITUTIONS: [
    { route: 'Home', icon: '⌂', label: '홈' },
    { route: 'RequestList', icon: '＋', label: '진료 요청' },
    { route: 'Inquiry', icon: '?', label: '문의하기' },
  ],
};

const publicRoutes = ['MainPreview', 'Login', 'Signup', 'AccountRecovery'];

export function Screen({
  children,
  contentStyle,
}: PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle> }>) {
  const { session } = useSession();
  const route = useRoute();

  if (!session || publicRoutes.includes(route.name)) {
    return (
      <ScrollView
        contentContainerStyle={[styles.publicScreen, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={[styles.appScreen, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </AppShell>
  );
}

function AppShell({ children }: PropsWithChildren) {
  const { session } = useSession();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const mobile = width < 760;
  const compact = width >= 760 && width < 1100;

  if (!session) return <>{children}</>;
  const items = roleNavigation[session.userType];
  const isActive = (item: NavItem) =>
    route.name === item.route ||
    (item.route === 'ArchiveList' && route.name === 'ArchiveDetail') ||
    (item.route === 'Inquiry' && route.name === 'InquiryDetail');

  const go = (name: string) => navigation.navigate(name);

  return (
    <View style={styles.shell}>
      {!mobile ? (
        <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
          <Pressable
            accessibilityLabel="로그인 홈으로 이동"
            accessibilityRole="link"
            onPress={() => go('Home')}
            style={styles.brandButton}
          >
            <Image
              resizeMode="contain"
              source={require('../../assets/hearo-wordmark.png')}
              style={[styles.wordmark, compact && styles.wordmarkCompact]}
            />
          </Pressable>

          <View style={[styles.quickPanel, compact && styles.quickPanelCompact]}>
            <Pressable
              accessibilityLabel={
                session.userType === 'WARD'
                  ? '새 진료 요청'
                  : session.userType === 'INSTITUTIONS'
                    ? '새 진료 요청 확인'
                    : '케어 연결 관리'
              }
              accessibilityRole="button"
              onPress={() =>
                go(
                  session.userType === 'WARD'
                    ? 'InstitutionSearch'
                    : session.userType === 'INSTITUTIONS'
                      ? 'RequestList'
                      : 'Care',
                )
              }
              style={({ pressed }) => [
                styles.quickAction,
                compact && styles.quickActionCompact,
                pressed && styles.quickActionPressed,
              ]}
            >
              <Text style={styles.quickActionIcon}>＋</Text>
              {!compact ? (
                <Text style={styles.quickActionText}>
                  {session.userType === 'WARD'
                    ? '새 진료 요청'
                    : session.userType === 'INSTITUTIONS'
                      ? '요청 확인'
                      : '연결 관리'}
                </Text>
              ) : null}
            </Pressable>
          </View>

          <Text style={[styles.navCaption, compact && styles.visuallyHidden]}>MY CARE</Text>
          <View style={styles.navList}>
            {items.map((item) => (
              <Pressable
                key={item.route}
                accessibilityRole="link"
                accessibilityState={{ selected: isActive(item) }}
                onPress={() => go(item.route)}
                style={({ pressed }) => [
                  styles.navItem,
                  compact && styles.navItemCompact,
                  isActive(item) && styles.navItemActive,
                  pressed && styles.navItemPressed,
                ]}
              >
                <Text style={[styles.navIcon, isActive(item) && styles.navTextActive]}>
                  {item.icon}
                </Text>
                {!compact ? (
                  <Text style={[styles.navLabel, isActive(item) && styles.navTextActive]}>
                    {item.label}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>

          <View style={styles.sidebarBottom}>
            {!compact ? (
              <View style={styles.safetyCard}>
                <View style={styles.safetyDot} />
                <View style={styles.safetyCopy}>
                  <Text style={styles.safetyTitle}>안전한 진료 기록</Text>
                  <Text style={styles.safetyText}>계정별 권한으로 보호됩니다.</Text>
                </View>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="link"
              onPress={() => go('Settings')}
              style={[styles.accountButton, compact && styles.accountButtonCompact]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{session.userId.slice(0, 1).toUpperCase()}</Text>
              </View>
              {!compact ? (
                <View style={styles.accountCopy}>
                  <Text numberOfLines={1} style={styles.accountName}>{session.userId}</Text>
                  <Text style={styles.accountRole}>{roleLabel(session.userType)}</Text>
                </View>
              ) : null}
              {!compact ? <Text style={styles.accountArrow}>›</Text> : null}
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.workspace}>
        <View style={styles.topbar}>
          {mobile ? (
            <Pressable accessibilityLabel="홈으로 이동" onPress={() => go('Home')}>
              <Image
                resizeMode="contain"
                source={require('../../assets/hearo-wordmark.png')}
                style={styles.mobileWordmark}
              />
            </Pressable>
          ) : (
            <View>
              <Text style={styles.topbarEyebrow}>HEARO CARE NOTE</Text>
              <Text style={styles.topbarTitle}>진료의 목소리를 이해하기 쉬운 기록으로</Text>
            </View>
          )}
          <View style={styles.topbarActions}>
            {!mobile ? (
              <Pressable
                accessibilityLabel="문의하기"
                onPress={() => go('Inquiry')}
                style={styles.topbarUtility}
              >
                <Text style={styles.topbarUtilityText}>도움이 필요하신가요?</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="마이페이지"
              onPress={() => go('Settings')}
              style={styles.profileButton}
            >
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>{session.userId.slice(0, 1).toUpperCase()}</Text>
              </View>
              {!mobile ? <Text style={styles.profileText}>{session.userId}님</Text> : null}
            </Pressable>
          </View>
        </View>
        <View style={styles.workspaceBody}>{children}</View>
      </View>

      {mobile ? (
        <View style={styles.mobileNav}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mobileNavContent}
          >
            {items.map((item) => (
              <Pressable
                key={item.route}
                accessibilityRole="link"
                accessibilityState={{ selected: isActive(item) }}
                onPress={() => go(item.route)}
                style={styles.mobileNavItem}
              >
                <Text style={[styles.mobileNavIcon, isActive(item) && styles.navTextActive]}>
                  {item.icon}
                </Text>
                <Text style={[styles.mobileNavLabel, isActive(item) && styles.navTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="link"
              accessibilityState={{ selected: route.name === 'Settings' }}
              onPress={() => go('Settings')}
              style={styles.mobileNavItem}
            >
              <Text style={[styles.mobileNavIcon, route.name === 'Settings' && styles.navTextActive]}>◎</Text>
              <Text style={[styles.mobileNavLabel, route.name === 'Settings' && styles.navTextActive]}>내 정보</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const mobile = width < 760;
  return (
    <View style={[styles.pageHeader, mobile && styles.pageHeaderMobile]}>
      <View style={styles.pageHeaderCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {description ? <Text style={styles.pageDescription}>{description}</Text> : null}
      </View>
      {actions ? <View style={[styles.pageActions, mobile && styles.pageActionsMobile]}>{actions}</View> : null}
    </View>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  style,
}: PropsWithChildren<{
  title?: string;
  description?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
            {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
          </View>
          {action ? <View>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  style,
  ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint && !error ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        placeholderTextColor={colors.faint}
        style={[
          styles.input,
          props.multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          error && styles.inputError,
          props.editable === false && styles.inputDisabled,
        ]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  tone = 'primary',
  compact,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  compact?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'ghost' && styles.buttonGhost,
        tone === 'danger' && styles.buttonDanger,
        pressed && !disabled && styles.buttonPressed,
        focused && styles.buttonFocused,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          (tone === 'secondary' || tone === 'ghost') && styles.buttonTextDark,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
    >
      <Text style={styles.iconButtonText}>{icon}</Text>
    </Pressable>
  );
}

export function Notice({
  children,
  tone = 'info',
  title,
}: PropsWithChildren<{
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
}>) {
  return (
    <View
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      style={[
        styles.notice,
        tone === 'success' && styles.noticeSuccess,
        tone === 'warning' && styles.noticeWarning,
        tone === 'error' && styles.noticeError,
      ]}
    >
      <View style={[styles.noticeDot, tone === 'error' && styles.noticeDotError]} />
      <View style={styles.noticeCopy}>
        {title ? <Text style={styles.noticeTitle}>{title}</Text> : null}
        <Text style={styles.noticeText}>{children}</Text>
      </View>
    </View>
  );
}

export function EmptyState({
  title = '표시할 내용이 없습니다.',
  children,
  action,
}: PropsWithChildren<{ title?: string; action?: ReactNode }>) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>○</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {children ? <Text style={styles.emptyText}>{children}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = '정보를 불러오고 있습니다.' }: { label?: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.loadingState}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'primary' && styles.badgePrimary,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warning' && styles.badgeWarning,
        tone === 'danger' && styles.badgeDanger,
      ]}
    >
      <View style={[styles.badgeDot, tone === 'danger' && styles.badgeDotDanger]} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{option.label}</Text>
            {option.count !== undefined ? (
              <Text style={[styles.tabCount, active && styles.tabCountActive]}>{option.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.modalOverlay}>
        <View style={styles.dialog}>
          <View style={styles.dialogIcon}><Text style={styles.dialogIconText}>!</Text></View>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogDescription}>{description}</Text>
          <View style={styles.dialogActions}>
            <View style={styles.dialogAction}>
              <Button title="취소" tone="secondary" onPress={onCancel} disabled={busy} />
            </View>
            <View style={styles.dialogAction}>
              <Button
                title={busy ? '처리 중…' : confirmLabel}
                tone={destructive ? 'danger' : 'primary'}
                onPress={onConfirm}
                disabled={busy}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function roleLabel(type: UserType) {
  return type === 'WARD' ? '피보호자' : type === 'GUARDIAN' ? '보호자' : '기관 사용자';
}

export function formatDate(value?: string | null, dateOnly = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateOnly ? date.toLocaleDateString('ko-KR') : date.toLocaleString('ko-KR');
}

export const uiStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  body: {
    color: colors.textSoft,
    fontFamily,
    fontSize: 14,
    lineHeight: 23,
  },
  muted: {
    color: colors.muted,
    fontFamily,
    fontSize: 12,
    lineHeight: 19,
  },
  link: {
    color: colors.primary,
    fontFamily,
    fontSize: 12,
    fontWeight: '800',
  },
});

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.canvas },
  sidebar: {
    width: 252,
    paddingHorizontal: 18,
    paddingTop: 23,
    paddingBottom: 18,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  sidebarCompact: { width: 84, paddingHorizontal: 12, alignItems: 'center' },
  brandButton: { alignSelf: 'flex-start' },
  wordmark: { width: 118, height: 42 },
  wordmarkCompact: { width: 58 },
  quickPanel: { marginTop: 26, marginBottom: 30 },
  quickPanelCompact: { alignSelf: 'stretch' },
  quickAction: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickActionCompact: { justifyContent: 'center', paddingHorizontal: 0 },
  quickActionPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.99 }] },
  quickActionIcon: { color: '#fff', fontFamily, fontSize: 19, fontWeight: '600' },
  quickActionText: { color: '#fff', fontFamily, fontSize: 12, fontWeight: '900' },
  navCaption: {
    color: colors.faint,
    fontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 9,
    paddingHorizontal: 11,
  },
  visuallyHidden: { opacity: 0, height: 0, marginBottom: 0 },
  navList: { alignSelf: 'stretch', gap: 3 },
  navItem: {
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navItemCompact: { justifyContent: 'center', paddingHorizontal: 0 },
  navItemActive: { backgroundColor: colors.primarySoft },
  navItemPressed: { backgroundColor: colors.surfaceMuted },
  navIcon: { width: 22, color: colors.muted, fontFamily, fontSize: 17, textAlign: 'center' },
  navLabel: { color: colors.textSoft, fontFamily, fontSize: 13, fontWeight: '700' },
  navTextActive: { color: colors.primary, fontWeight: '900' },
  sidebarBottom: { marginTop: 'auto', alignSelf: 'stretch', gap: 14 },
  safetyCard: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  safetyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  safetyCopy: { flex: 1 },
  safetyTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  safetyText: { color: colors.muted, fontFamily, fontSize: 8, marginTop: 3 },
  accountButton: {
    minHeight: 57,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountButtonCompact: { justifyContent: 'center' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily, fontWeight: '900' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { color: colors.text, fontFamily, fontSize: 12, fontWeight: '900' },
  accountRole: { color: colors.muted, fontFamily, fontSize: 9, marginTop: 3 },
  accountArrow: { color: colors.faint, fontFamily, fontSize: 22 },
  workspace: { flex: 1, minWidth: 0 },
  workspaceBody: { flex: 1, minHeight: 0 },
  topbar: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topbarEyebrow: {
    color: colors.primary,
    fontFamily,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  topbarTitle: { color: colors.textSoft, fontFamily, fontSize: 11, fontWeight: '700', marginTop: 3 },
  topbarActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 },
  topbarUtility: { padding: 10 },
  topbarUtilityText: { color: colors.muted, fontFamily, fontSize: 10, fontWeight: '700' },
  profileButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: { color: '#fff', fontFamily, fontSize: 10, fontWeight: '900' },
  profileText: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '800', paddingRight: 5 },
  mobileWordmark: { width: 88, height: 34 },
  mobileNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 68,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  mobileNavContent: { minWidth: '100%', paddingHorizontal: 6 },
  mobileNavItem: { minWidth: 72, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  mobileNavIcon: { color: colors.muted, fontFamily, fontSize: 17 },
  mobileNavLabel: { color: colors.muted, fontFamily, fontSize: 9, fontWeight: '700' },
  publicScreen: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    padding: 22,
    paddingBottom: 70,
    backgroundColor: colors.canvas,
  },
  appScreen: {
    flexGrow: 1,
    width: '100%',
    gap: 20,
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 100,
  },
  pageHeader: {
    minHeight: 106,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 20,
  },
  pageHeaderMobile: {
    minHeight: 0,
    paddingBottom: 20,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  pageHeaderCopy: { flex: 1, maxWidth: 760 },
  eyebrow: {
    color: colors.primary,
    fontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  pageTitle: {
    color: colors.text,
    fontFamily,
    fontSize: 29,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 8,
  },
  pageDescription: {
    color: colors.muted,
    fontFamily,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 7,
  },
  pageActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageActionsMobile: { alignSelf: 'flex-start', flexWrap: 'wrap' },
  section: {
    gap: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 23,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  sectionHeading: { flex: 1 },
  sectionTitle: { color: colors.text, fontFamily, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  sectionDescription: { color: colors.muted, fontFamily, fontSize: 11, lineHeight: 18, marginTop: 5 },
  field: { gap: 7 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  fieldLabel: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  fieldHint: { color: colors.faint, fontFamily, fontSize: 9 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
    outlineStyle: 'none',
  } as never,
  inputMultiline: { minHeight: 128, textAlignVertical: 'top' },
  inputFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  inputError: { borderColor: colors.danger },
  inputDisabled: { backgroundColor: colors.surfaceSoft, color: colors.muted },
  fieldError: { color: colors.danger, fontFamily, fontSize: 10, fontWeight: '700' },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 38, borderRadius: radius.sm, paddingHorizontal: 13 },
  buttonSecondary: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  buttonGhost: { backgroundColor: colors.primarySoft },
  buttonDanger: { backgroundColor: colors.danger },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  buttonFocused: { borderWidth: 2, borderColor: colors.ink },
  buttonDisabled: { opacity: 0.42 },
  buttonText: { color: '#fff', fontFamily, fontSize: 12, fontWeight: '900' },
  buttonTextDark: { color: colors.text },
  iconButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { backgroundColor: colors.surfaceSoft },
  iconButtonText: { color: colors.text, fontFamily, fontSize: 16, fontWeight: '800' },
  notice: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  noticeSuccess: { borderColor: '#c7e3d3', backgroundColor: colors.successSoft },
  noticeWarning: { borderColor: '#ead5ad', backgroundColor: colors.warningSoft },
  noticeError: { borderColor: '#e7c2bf', backgroundColor: colors.dangerSoft },
  noticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  noticeDotError: { backgroundColor: colors.danger },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900', marginBottom: 3 },
  noticeText: { color: colors.textSoft, fontFamily, fontSize: 11, lineHeight: 18 },
  emptyState: {
    minHeight: 220,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.canvas,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: { color: colors.primary, fontFamily, fontSize: 20, fontWeight: '900' },
  emptyTitle: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  emptyText: { color: colors.muted, fontFamily, fontSize: 11, lineHeight: 18, marginTop: 7, textAlign: 'center', maxWidth: 420 },
  emptyAction: { marginTop: 16 },
  loadingState: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontFamily, fontSize: 11 },
  badge: {
    alignSelf: 'center',
    minHeight: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  badgePrimary: { backgroundColor: colors.primarySoft },
  badgeSuccess: { backgroundColor: colors.successSoft },
  badgeWarning: { backgroundColor: colors.warningSoft },
  badgeDanger: { backgroundColor: colors.dangerSoft },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  badgeDotDanger: { backgroundColor: colors.danger },
  badgeText: { color: colors.textSoft, fontFamily, fontSize: 10, fontWeight: '900' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  tabActive: { borderColor: colors.text, backgroundColor: colors.surface },
  tabText: { color: colors.muted, fontFamily, fontSize: 10, fontWeight: '800' },
  tabTextActive: { color: colors.text, fontWeight: '900' },
  tabCount: { color: colors.faint, fontFamily, fontSize: 9, fontWeight: '800' },
  tabCountActive: { color: colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,35,31,0.42)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 28,
    alignItems: 'center',
  },
  dialogIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogIconText: { color: colors.warning, fontFamily, fontSize: 20, fontWeight: '900' },
  dialogTitle: { color: colors.text, fontFamily, fontSize: 20, fontWeight: '900', marginTop: 18, textAlign: 'center' },
  dialogDescription: { color: colors.muted, fontFamily, fontSize: 12, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  dialogActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 24 },
  dialogAction: { flex: 1 },
});
