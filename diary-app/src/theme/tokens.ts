import { Platform } from 'react-native';

import type { FontScaleKey, LineHeightKey } from './palette';

export * from './palette';

export type FontFamilyKey = 'serif' | 'sans' | 'kai';

export const FONT_FAMILIES: { key: FontFamilyKey; name: string; desc: string; sample: string }[] = [
  { key: 'serif', name: '宋体', desc: '衬线，安静的手账感', sample: '记得当时' },
  { key: 'sans', name: '黑体', desc: '无衬线，清爽利落', sample: '记得当时' },
  { key: 'kai', name: '楷体', desc: '手写笔意，像写在本子上', sample: '记得当时' },
];

/** 标题字体族；正文仍用系统字，保证长文可读 */
export const FONT_STACK: Record<FontFamilyKey, string | undefined> = {
  serif: undefined, // 由 SERIF / SERIF_BOLD 提供
  sans: Platform.select({
    web: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    default: undefined, // 系统默认即 SF / 苹方 / Roboto
  }),
  kai: Platform.select({
    web: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif',
    ios: 'Kaiti SC',
    android: 'serif', // Android 没有内置楷体，回落到衬线
    default: 'serif',
  }),
};

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
