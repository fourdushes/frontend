import { PropsWithChildren, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, fontFamily, radius } from '../theme/theme';

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const mobile = width < 760;
  const pagePadding = mobile ? 16 : 30;
  const sidebarWidth = mobile ? 0 : width < 1100 ? 84 : 252;
  return { width, height, fontScale, mobile, narrow: width < 400, short: height < 700,
    pagePadding, contentWidth: width - sidebarWidth - pagePadding * 2 };
}

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

export function Disclosure({ title, children, initiallyOpen = true }: PropsWithChildren<{
  title: string; initiallyOpen?: boolean;
}>) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={styles.disclosure}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
      onPress={() => setOpen(value => !value)} style={styles.toggle}>
      <Text style={styles.title}>{title}</Text><Text style={styles.indicator}>{open ? '접기 −' : '펼치기 +'}</Text>
    </Pressable>
    {open ? <View style={styles.body}>{children}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  disclosure: { width: '100%', minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  toggle: { minHeight: 48, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, minWidth: 0, color: colors.text, fontFamily, fontWeight: '800', fontSize: 15 },
  indicator: { color: colors.primary, fontFamily, fontWeight: '700', fontSize: 14 },
  body: { padding: 12, paddingTop: 0, gap: 12, minWidth: 0 },
});
