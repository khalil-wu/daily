import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontScaleKey = 'standard' | 'large' | 'xlarge';
export type LineHeightKey = 'compact' | 'standard' | 'relaxed';

export interface Palette {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryFaint: string;
  bg: string;
  bgDeep: string;
  card: string;
  cardAlt: string;
  divider: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textOnPrimary: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  overlay: string;
  shadow: string;
  inputBg: string;
}

/** 强调色（外观主题中可选） */
export const ACCENTS = [
  { key: 'latte', name: '奶茶', color: '#B79276', dark: '#9C7A60', soft: '#E8D9C9', faint: '#F3EBE2' },
  { key: 'rose', name: '藕粉', color: '#D9A3A0', dark: '#BF8784', soft: '#F2DCDA', faint: '#F9EEED' },
  { key: 'lavender', name: '雾紫', color: '#A9A3CF', dark: '#8C86B5', soft: '#E1DEF0', faint: '#F0EEF7' },
  { key: 'mist', name: '雾蓝', color: '#86ABCB', dark: '#6A8FB0', soft: '#D8E5F0', faint: '#ECF2F8' },
  { key: 'sage', name: '青苔', color: '#9DBF9E', dark: '#7FA381', soft: '#DCEADC', faint: '#EEF5EE' },
] as const;
export type AccentKey = (typeof ACCENTS)[number]['key'];

export function buildPalette(dark: boolean, accentKey: AccentKey): Palette {
  const a = ACCENTS.find(x => x.key === accentKey) ?? ACCENTS[0];
  if (!dark) {
    return {
      primary: a.color,
      primaryDark: a.dark,
      primarySoft: a.soft,
      primaryFaint: a.faint,
      bg: '#F8F5EF',
      bgDeep: '#F1ECE4',
      card: '#FFFFFF',
      cardAlt: '#FBF8F4',
      divider: '#EDE6DE',
      border: '#E6DDD3',
      text: '#2F2A26',
      textSub: '#7A746E',
      textMuted: '#ABA39A',
      textOnPrimary: '#FFFFFF',
      danger: '#D46A5E',
      dangerSoft: '#F8E3DF',
      success: '#7FA97F',
      successSoft: '#E4EFE2',
      warning: '#E3A54F',
      warningSoft: '#FAEBD5',
      info: '#86ABCB',
      overlay: 'rgba(47,42,38,0.42)',
      shadow: '#8A6E58',
      inputBg: '#F6F2EC',
    };
  }
  return {
    primary: a.color,
    primaryDark: a.dark,
    primarySoft: '#3D342C',
    primaryFaint: '#2C2622',
    bg: '#1A1714',
    bgDeep: '#141210',
    card: '#25211D',
    cardAlt: '#2A2521',
    divider: '#36302A',
    border: '#3A332D',
    text: '#EFE8E0',
    textSub: '#ADA398',
    textMuted: '#7A7168',
    textOnPrimary: '#FFFFFF',
    danger: '#E07B6F',
    dangerSoft: '#3A2522',
    success: '#8DB78D',
    successSoft: '#26332A',
    warning: '#E8B062',
    warningSoft: '#3A2F20',
    info: '#86ABCB',
    overlay: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
    inputBg: '#2C2723',
  };
}

export const FONT_SCALE: Record<FontScaleKey, number> = { standard: 1, large: 1.1, xlarge: 1.22 };
export const LINE_HEIGHT: Record<LineHeightKey, number> = { compact: 1.55, standard: 1.8, relaxed: 2.05 };

export const SERIF = Platform.select({
  web: '"NotoSerifSC", "Songti SC", "Noto Serif CJK SC", "STSong", Georgia, serif',
  default: 'NotoSerifSC',
});

/**
 * 半粗衬线：Android 和 iOS 都无法对单字重自定义字体合成粗体，
 * 所以「衬线 + fontWeight:600」在双端都会丢掉字重或字形——
 * 所有 600 字重的衬线标题统一改用这个字族。
 */
export const SERIF_BOLD = Platform.select({
  web: '"NotoSerifSC-SemiBold", "NotoSerifSC", "Songti SC", "Noto Serif CJK SC", "STSong", Georgia, serif',
  default: 'NotoSerifSC-SemiBold',
});

export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
