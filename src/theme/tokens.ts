import { Appearance, Platform } from 'react-native';

type FontFamilyTokens = {
  sans: string;
  display: string;
  reading: string;
  mono: string;
};

type TypographyTokens = {
  fontFamily: FontFamilyTokens;
  display: number;
  titleLg: number;
  title: number;
  metricLg: number;
  postBody: number;
  body: number;
  caption: number;
  micro: number;
  lineHeights: {
    display: number;
    titleLg: number;
    title: number;
    metricLg: number;
    postBody: number;
    body: number;
    caption: number;
    micro: number;
  };
};

type ColorTokens = {
  bgPrimary: string;
  bgSecondary: string;
  bgElevated: string;
  bgPaper: string;
  bgWash: string;
  surfaceMint: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentDim: string;
  secondary: string;
  socialName: string;
  edge: string;
  divider: string;
  line: string;
  glow: string;
  danger: string;
  overlay: string;
  scrim: string;
  stroke: string;
  strokeSoft: string;
  avatarTints: readonly string[];
};

type AlphaTokens = {
  accent8: string;
  accent10: string;
  accent16: string;
  accent22: string;
  secondary12: string;
  secondary24: string;
  danger10: string;
  danger22: string;
  danger34: string;
  scrim: string;
};

const platform = Platform.OS;

// 日系圆体卡通风（Claymorphism）：标题用中文卡通圆体（ZCOOL KuaiLe 站酷快乐体），
// 正文用 Nunito + 系统圆体。Native 用系统圆体栈兜底。
const webSansFont =
  '"Nunito", "Hiragino Maru Gothic", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif';

const webDisplayFont =
  '"ZCOOL KuaiLe", "Fredoka", "Nunito", "Hiragino Maru Gothic", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

const iosSansFont = '"Hiragino Maru Gothic ProN", "PingFang SC"';
const androidSansFont = '"Microsoft YaHei", "Noto Sans SC"';

const webReadingFont =
  '"Nunito", "Hiragino Maru Gothic", "Microsoft YaHei", "PingFang SC", "Songti SC", serif';

const fontFamily: FontFamilyTokens = {
  sans:
    platform === 'web'
      ? webSansFont
      : platform === 'ios'
        ? iosSansFont
        : androidSansFont,
  display:
    platform === 'web'
      ? webDisplayFont
      : platform === 'ios'
        ? iosSansFont
        : androidSansFont,
  reading:
    platform === 'web'
      ? webReadingFont
      : platform === 'ios'
        ? '"Hiragino Maru Gothic ProN", "Songti SC"'
        : '"Microsoft YaHei", serif',
  mono:
    platform === 'web'
      ? '"SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", monospace'
      : platform === 'ios'
        ? 'Menlo'
        : 'monospace',
};

export const lightColors: ColorTokens = {
  bgPrimary: '#FFF8EE',
  bgSecondary: '#FFFFFF',
  bgElevated: '#FBEFD9',
  bgPaper: '#FFFFFF',
  bgWash: '#FBEFD9',
  surfaceMint: '#FCEFD8',
  textPrimary: '#3D2E22',
  textSecondary: '#7A6553',
  textTertiary: '#A89484',
  accent: '#E89B5B',
  accentDim: '#D4884A',
  secondary: '#F4C95D',
  socialName: '#D4884A',
  edge: '#E8B57A',
  divider: '#F2E6D2',
  line: '#E8D9BE',
  glow: 'rgba(232, 155, 91, 0.22)',
  danger: '#D97070',
  overlay: 'rgba(61, 46, 34, 0.34)',
  scrim: 'rgba(61, 46, 34, 0.44)',
  // 卡通线稿描边色：深暖棕，用于卡片/按钮/头像的粗描边，是 Claymorphism 的核心。
  stroke: '#5A3A22',
  strokeSoft: '#8A6A4A',
  avatarTints: ['#FFD9A8', '#FFE6A8', '#FCC4C4', '#FBD7A8', '#F8C9A8', '#FFDDB5'],
};

export const darkColors: ColorTokens = {
  bgPrimary: '#211912',
  bgSecondary: '#2D2118',
  bgElevated: '#3B2A1D',
  bgPaper: '#35271D',
  bgWash: '#4A3321',
  surfaceMint: '#4B3A22',
  textPrimary: '#FFF3E4',
  textSecondary: '#E4CBB4',
  textTertiary: '#B99B82',
  accent: '#F2B06F',
  accentDim: '#DB9254',
  secondary: '#F0C85A',
  socialName: '#F2B06F',
  edge: '#C9824B',
  divider: '#563D2A',
  line: '#755237',
  glow: 'rgba(242, 176, 111, 0.26)',
  danger: '#F29A93',
  overlay: 'rgba(11, 8, 6, 0.54)',
  scrim: 'rgba(11, 8, 6, 0.68)',
  // 暗色模式继续使用暖棕粗描边，只提升亮度避免卡片边界沉进背景。
  stroke: '#D8A36D',
  strokeSoft: '#B8865D',
  avatarTints: ['#8C5A2E', '#8E7030', '#8A4C4C', '#875A30', '#8C5132', '#906037'],
};

export const lightAlpha: AlphaTokens = {
  accent8: 'rgba(232, 155, 91, 0.08)',
  accent10: 'rgba(232, 155, 91, 0.10)',
  accent16: 'rgba(232, 155, 91, 0.16)',
  accent22: 'rgba(232, 155, 91, 0.22)',
  secondary12: 'rgba(244, 201, 93, 0.18)',
  secondary24: 'rgba(244, 201, 93, 0.30)',
  danger10: 'rgba(217, 112, 112, 0.10)',
  danger22: 'rgba(217, 112, 112, 0.22)',
  danger34: 'rgba(217, 112, 112, 0.34)',
  scrim: 'rgba(61, 46, 34, 0.44)',
};

export const darkAlpha: AlphaTokens = {
  accent8: 'rgba(242, 176, 111, 0.12)',
  accent10: 'rgba(242, 176, 111, 0.16)',
  accent16: 'rgba(242, 176, 111, 0.24)',
  accent22: 'rgba(242, 176, 111, 0.32)',
  secondary12: 'rgba(240, 200, 90, 0.18)',
  secondary24: 'rgba(240, 200, 90, 0.30)',
  danger10: 'rgba(242, 154, 147, 0.14)',
  danger22: 'rgba(242, 154, 147, 0.26)',
  danger34: 'rgba(242, 154, 147, 0.38)',
  scrim: 'rgba(11, 8, 6, 0.68)',
};

export const colorScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

function themeValue<T extends Record<string, string | readonly string[]>>(light: T, dark: T): T {
  if (platform !== 'web') return colorScheme === 'dark' ? dark : light;

  return Object.fromEntries(
    Object.keys(light).map((key) => {
      const lightValue = light[key];
      const darkValue = dark[key];
      if (Array.isArray(lightValue)) return [key, lightValue];
      return [key, `light-dark(${lightValue}, ${darkValue})`];
    }),
  ) as T;
}

export const colors = themeValue(lightColors, darkColors);
export const alpha = themeValue(lightAlpha, darkAlpha);

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  giant: 48,
};

export const radius = {
  card: 20,
  button: 18,
  input: 14,
  pill: 999,
  circle: 999,
};

// 卡通粗描边粗细（Claymorphism：3-4px 粗描边勾勒形状）
export const strokeWidth = {
  card: 2.5,
  button: 2.5,
  input: 2,
  avatar: 2.5,
  icon: 2.2,
};

export const lightShadows = {
  // 日系卡通贴纸风：粗描边 + 明显外阴影位移，像贴在纸上的圆角贴纸。
  card: {
    shadowColor: '#5A3A22',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  accent: {
    shadowColor: '#5A3A22',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  sheet: {
    shadowColor: '#5A3A22',
    shadowOpacity: 0.30,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    boxShadow: '0 8px 32px rgba(61, 46, 34, 0.30)',
  },
};

export const darkShadows = {
  card: {
    shadowColor: '#090604',
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  accent: {
    shadowColor: '#090604',
    shadowOpacity: 0.40,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  sheet: {
    shadowColor: '#090604',
    shadowOpacity: 0.48,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    boxShadow: '0 10px 34px rgba(9, 6, 4, 0.48)',
  },
};

export const shadows = colorScheme === 'dark' && platform !== 'web' ? darkShadows : lightShadows;

export const typography: TypographyTokens = {
  fontFamily,
  display: 28,
  titleLg: 22,
  title: 17,
  metricLg: 30,
  postBody: 18,
  body: 16,
  caption: 13,
  micro: 11,
  lineHeights: {
    display: 36,
    titleLg: 30,
    title: 24,
    metricLg: 36,
    postBody: 34,
    body: 27,
    caption: 19,
    micro: 16,
  },
};

// 字重 token：统一散落全项目的 '400'..'800' 字面量，新代码引用这里。
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
