import { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { colors, spacing } from '../theme/theme';

export function Screen({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Section({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </View>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        autoCapitalize="none"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  tone = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, tone === 'secondary' && styles.buttonTextSecondary]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function ActionCard({
  title,
  description,
  meta,
  onPress,
}: {
  title: string;
  description: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionCard}>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {meta ? <Text style={styles.actionMeta}>{meta}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function Notice({
  children,
  tone = 'info',
}: PropsWithChildren<{ tone?: 'info' | 'warning' | 'error' }>) {
  return (
    <View
      style={[
        styles.notice,
        tone === 'warning' && styles.noticeWarning,
        tone === 'error' && styles.noticeError,
      ]}
    >
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function EmptyState({ children }: PropsWithChildren) {
  return (
    <View style={styles.empty}>
      <Text style={styles.description}>{children}</Text>
    </View>
  );
}

export function ResultBox({
  loading,
  error,
  value,
}: {
  loading?: boolean;
  error?: string | null;
  value?: unknown;
}) {
  if (loading) {
    return (
      <View style={styles.result}>
        <ActivityIndicator />
        <Text style={styles.description}>요청 중...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.result, error ? styles.resultError : undefined]}>
      <Text selectable style={[styles.code, error ? styles.errorText : undefined]}>
        {error || (value === undefined ? '아직 실행하지 않았습니다.' : JSON.stringify(value, null, 2))}
      </Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  pageTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});

const styles = StyleSheet.create({
  screen: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: 80,
  },
  section: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#fbfcfe',
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonTextSecondary: {
    color: colors.text,
  },
  result: {
    minHeight: 54,
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.code,
    padding: 12,
  },
  resultError: {
    backgroundColor: '#401925',
  },
  code: {
    flex: 1,
    color: '#d7e3f4',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: '#ffd4dc',
  },
  actionCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  actionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  actionMeta: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  chevron: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '300',
  },
  notice: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
  },
  noticeWarning: {
    borderLeftColor: colors.warning,
    backgroundColor: '#fff5df',
  },
  noticeError: {
    borderLeftColor: colors.danger,
    backgroundColor: '#feecef',
  },
  noticeText: {
    color: colors.text,
    lineHeight: 20,
  },
  empty: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
  },
});
