import { Platform } from 'react-native';

export const colors = {
  canvas: '#f7faf9',
  background: '#ffffff',
  surface: '#ffffff',
  surfaceSoft: '#f3f7f6',
  surfaceMuted: '#eaf4f1',
  text: '#17202b',
  textSoft: '#35414b',
  muted: '#68717c',
  faint: '#98a19f',
  border: '#dde5e2',
  borderStrong: '#bdccc7',
  primary: '#087f87',
  primaryHover: '#076e75',
  primaryPressed: '#075f66',
  primaryDark: '#075f66',
  primarySoft: '#e9f6f6',
  primaryBorder: '#bfdfdc',
  mint: '#d9f2f2',
  accent: '#ef873d',
  accentSoft: '#fff2e8',
  success: '#237a57',
  successSoft: '#eaf6ef',
  warning: '#a96515',
  warningSoft: '#fff4df',
  danger: '#b84a45',
  dangerSoft: '#fceceb',
  info: '#39745f',
  ink: '#0b6f68',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const fontFamily = Platform.select({
  web: 'Pretendard, "Noto Sans KR", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: undefined,
});
