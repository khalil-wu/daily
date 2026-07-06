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
  surfaceWarm: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentDim: string;
  accentPop: string;
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
  pop8: string;
  pop16: string;
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
  bgPrimary: '#FFF6E8',
  bgSecondary: '#FFFFFF',
  bgElevated: '#FBEFD9',
  bgPaper: '#FFFFFF',
  bgWash: '#F6E8D0',
  surfaceMint: '#FCEFD8',
  surfaceWarm: '#FFE4C4',
  textPrimary: '#3D2A1A',
  textSecondary: '#6B5644',
  textTertiary: '#8A7560',
  accent: '#E8945B',
  accentDim: '#D4844A',
  accentPop: '#5BB8C4',
  secondary: '#F4C95D',
  socialName: '#C9783A',
  edge: '#E8B57A',
  divider: '#EDDFC8',
  line: '#E0CFAE',
  glow: 'rgba(232, 148, 91, 0.24)',
  danger: '#DC6B6B',
  overlay: 'rgba(61, 42, 26, 0.38)',
  scrim: 'rgba(61, 42, 26, 0.48)',
  // 日漫墨线描边色：接近纯黑的深暖棕，模拟漫画钢笔墨线，是 manga ink 的核心。
  stroke: '#3D2A1A',
  strokeSoft: '#7A6248',
  avatarTints: ['#FFD9A8', '#FFE6A8', '#FCC4C4', '#FBD7A8', '#F8C9A8', '#FFDDB5', '#C4E8EC'],
};

export const darkColors: ColorTokens = {
  bgPrimary: '#1E160E',
  bgSecondary: '#2A1F15',
  bgElevated: '#3A2A1C',
  bgPaper: '#322419',
  bgWash: '#483220',
  surfaceMint: '#4A3820',
  surfaceWarm: '#5A3A1E',
  textPrimary: '#FFF3E4',
  textSecondary: '#E4CBB4',
  textTertiary: '#C4A688',
  accent: '#F4B870',
  accentDim: '#DC9A56',
  accentPop: '#6ECDD8',
  secondary: '#F0CC5A',
  socialName: '#F4B870',
  edge: '#CC8852',
  divider: '#5A4030',
  line: '#7A5840',
  glow: 'rgba(244, 184, 112, 0.28)',
  danger: '#F29A93',
  overlay: 'rgba(8, 5, 3, 0.58)',
  scrim: 'rgba(8, 5, 3, 0.72)',
  // 暗色模式墨线：用暖金描边保持可见性，模拟夜幕下的墨色。
  stroke: '#E8B878',
  strokeSoft: '#C09868',
  avatarTints: ['#8C5A2E', '#8E7030', '#8A4C4C', '#875A30', '#8C5132', '#906037', '#3A7078'],
};

export const lightAlpha: AlphaTokens = {
  accent8: 'rgba(232, 148, 91, 0.08)',
  accent10: 'rgba(232, 148, 91, 0.10)',
  accent16: 'rgba(232, 148, 91, 0.16)',
  accent22: 'rgba(232, 148, 91, 0.22)',
  secondary12: 'rgba(244, 201, 93, 0.18)',
  secondary24: 'rgba(244, 201, 93, 0.30)',
  danger10: 'rgba(220, 107, 107, 0.10)',
  danger22: 'rgba(220, 107, 107, 0.22)',
  danger34: 'rgba(220, 107, 107, 0.34)',
  pop8: 'rgba(91, 184, 196, 0.10)',
  pop16: 'rgba(91, 184, 196, 0.18)',
  scrim: 'rgba(61, 42, 26, 0.48)',
};

export const darkAlpha: AlphaTokens = {
  accent8: 'rgba(244, 184, 112, 0.12)',
  accent10: 'rgba(244, 184, 112, 0.16)',
  accent16: 'rgba(244, 184, 112, 0.24)',
  accent22: 'rgba(244, 184, 112, 0.32)',
  secondary12: 'rgba(240, 204, 90, 0.18)',
  secondary24: 'rgba(240, 204, 90, 0.30)',
  danger10: 'rgba(242, 154, 147, 0.14)',
  danger22: 'rgba(242, 154, 147, 0.26)',
  danger34: 'rgba(242, 154, 147, 0.38)',
  pop8: 'rgba(110, 205, 216, 0.14)',
  pop16: 'rgba(110, 205, 216, 0.22)',
  scrim: 'rgba(8, 5, 3, 0.72)',
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

// 日漫墨线粗细：3px 粗描边模拟漫画钢笔线，heavy 用于强调面板边框。
export const strokeWidth = {
  card: 3,
  button: 3,
  input: 2,
  avatar: 3,
  icon: 2.2,
  heavy: 3.5,
};

export const lightShadows = {
  // 日漫贴纸风：粗墨线 + 硬边偏移投影，像剪贴在纸上的漫画分镜面板。
  card: {
    shadowColor: '#3D2A1A',
    shadowOpacity: 0.20,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  accent: {
    shadowColor: '#3D2A1A',
    shadowOpacity: 0.30,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  sheet: {
    shadowColor: '#3D2A1A',
    shadowOpacity: 0.38,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    boxShadow: '0 10px 28px rgba(61, 42, 26, 0.38)',
  },
  pop: {
    shadowColor: '#3D2A1A',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
};

export const darkShadows = {
  card: {
    shadowColor: '#060402',
    shadowOpacity: 0.42,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  accent: {
    shadowColor: '#060402',
    shadowOpacity: 0.50,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  sheet: {
    shadowColor: '#060402',
    shadowOpacity: 0.58,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    boxShadow: '0 12px 28px rgba(6, 4, 2, 0.58)',
  },
  pop: {
    shadowColor: '#060402',
    shadowOpacity: 0.30,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
  caption: 14,
  micro: 12,
  lineHeights: {
    display: 36,
    titleLg: 30,
    title: 24,
    metricLg: 36,
    postBody: 34,
    body: 27,
    caption: 20,
    micro: 17,
  },
};

// 字重 token：统一散落全项目的 '400'..'800' 字面量，新代码引用这里。
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
