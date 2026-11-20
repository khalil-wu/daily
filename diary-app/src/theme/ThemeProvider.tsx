import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';
import { useStore } from '../store/store';
import { buildPalette, FONT_SCALE, LINE_HEIGHT, scaleRadius, SERIF, SERIF_BOLD, stylePreset, type Palette, type StylePreset } from './tokens';

export interface Theme {
  c: Palette;
  dark: boolean;
  scale: number; // 字体缩放
  lineHeight: number; // 正文行高倍数
  contentWidth: number;
  fs: (size: number) => number;
  /** 当前风格（圆角、是否投影等） */
  look: StylePreset;
  /** 圆角随风格缩放：borderRadius: r(16) */
  r: (n: number) => number;
  /** 卡片外框：圆润风格是极细描边 + 柔和投影，利落风格是一条清晰的线 */
  frame: ViewStyle;
  serif: string;
  /** 常用字体样式 */
  t: {
    display: TextStyle; // 大标题 28-32
    h1: TextStyle; // 页面标题 22-24
    h2: TextStyle; // 小标题 18
    h3: TextStyle; // 卡片标题 16
    body: TextStyle; // 正文 15
    bodySerif: TextStyle; // 阅读正文
    sub: TextStyle; // 次要 13
    caption: TextStyle; // 辅助 12
    tiny: TextStyle; // 11
  };
}

const ThemeCtx = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme();
  const ap = useStore(s => s.appearance);
  const dark = ap.theme === 'dark' || (ap.theme === 'system' && sys === 'dark');

  const theme = useMemo<Theme>(() => {
    const look = stylePreset(ap.style);
    const c = buildPalette(dark, ap.accent, look.key);
    const r = (n: number) => scaleRadius(n, look);
    const frame: ViewStyle = look.flat
      ? { borderWidth: 1, borderColor: c.border }
      : {
          borderWidth: dark ? 0 : StyleSheet.hairlineWidth,
          borderColor: c.divider,
          shadowColor: c.shadow,
          shadowOpacity: dark ? 0 : 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 3 },
          elevation: dark ? 0 : 1,
        };
    const scale = FONT_SCALE[ap.fontScale] ?? 1;
    const lh = LINE_HEIGHT[ap.lineHeight] ?? 1.8;
    const fs = (n: number) => Math.round(n * scale * 10) / 10;
    // 双端都不能对单字重自定义字体合成粗体：600 字重的衬线改用真实的 SemiBold 字族
    const serifBold: Pick<TextStyle, 'fontFamily'> = { fontFamily: SERIF_BOLD };
    return {
      c,
      dark,
      scale,
      lineHeight: lh,
      contentWidth: ap.contentWidth,
      fs,
      look,
      r,
      frame,
      serif: SERIF,
      t: {
        display: { fontFamily: SERIF, fontSize: fs(30), color: c.text, letterSpacing: 1.5, ...serifBold },
        h1: { fontFamily: SERIF, fontSize: fs(22), color: c.text, letterSpacing: 0.3, ...serifBold },
        h2: { fontFamily: SERIF, fontSize: fs(18), color: c.text, ...serifBold },
        h3: { fontFamily: SERIF, fontSize: fs(16), color: c.text, ...serifBold },
        body: { fontSize: fs(15), color: c.text, lineHeight: fs(15) * 1.6 },
        bodySerif: { fontFamily: SERIF, fontSize: fs(16), color: c.text, lineHeight: fs(16) * lh },
        sub: { fontSize: fs(13), color: c.textSub, lineHeight: fs(13) * 1.55 },
        caption: { fontSize: fs(12), color: c.textSub },
        tiny: { fontSize: fs(11), color: c.textMuted },
      },
    };
  }, [dark, ap.accent, ap.style, ap.fontScale, ap.lineHeight, ap.contentWidth]);

  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeCtx);
  if (!t) throw new Error('useTheme must be used within ThemeProvider');
  return t;
}

/** 根据主题生成样式，主题变化时自动重算 */
export function useStyles<T>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
}
