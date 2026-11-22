import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';
import { useStore } from '../store/store';
import { ILLUSTRATION_PACKS } from '../data/assets';
import { buildPalette, FONT_SCALE, LINE_HEIGHT, resolveFontRoles, resolveTextFont, scaleRadius, stylePreset, type FontRoles, type Palette, type StylePreset } from './tokens';

export interface Theme {
  c: Palette;
  dark: boolean;
  scale: number;
  lineHeight: number;
  contentWidth: number;
  fs: (size: number) => number;
  look: StylePreset;
  r: (n: number) => number;
  frame: ViewStyle;
  /** 线绘陪伴风的墨线 token：on 仅在该风格下为真 */
  ink: { on: boolean; line: string; soft: string };
  /** 主视觉卡片的墨线框：粗墨线 + 硬投影，其余风格等同 frame */
  frameInk: ViewStyle;
  /** Stable platform UI font, independent of the user's reading font. */
  ui: string;
  fonts: FontRoles;
  fontsReady: boolean;
  /** Legacy reading-family alias. */
  serif: string;
  reading: string;
  readingBold: string | undefined;
  t: {
    display: TextStyle;
    h1: TextStyle;
    h2: TextStyle;
    h3: TextStyle;
    body: TextStyle;
    /** User-content title. Page titles use h1 / h2 / h3. */
    readingTitle: TextStyle;
    /** Legacy name retained: this follows all three reading font choices. */
    bodySerif: TextStyle;
    sub: TextStyle;
    caption: TextStyle;
    tiny: TextStyle;
  };
}

const ThemeCtx = createContext<Theme | null>(null);

export function ThemeProvider({ children, fontsReady = true }: { children: React.ReactNode; fontsReady?: boolean }) {
  const sys = useColorScheme();
  const ap = useStore(s => s.appearance);
  const dark = ap.theme === 'dark' || (ap.theme === 'system' && sys === 'dark');

  const theme = useMemo<Theme>(() => {
    const look = stylePreset(ap.style);
    const c = buildPalette(dark, ap.accent, look.key);
    const r = (n: number) => scaleRadius(n, look);
    const inkLook = look.key === 'companion';
    const ink = { on: inkLook, line: dark ? '#6F878F' : '#243238', soft: c.divider };
    // 墨线是点缀不是默认：陪伴风普通容器只用 1px 柔和分隔线
    const frame: ViewStyle = inkLook
      ? { borderWidth: 1, borderColor: c.divider, shadowOpacity: 0, elevation: 0 }
      : {
          borderWidth: look.flat ? 1 : StyleSheet.hairlineWidth,
          borderColor: look.flat ? c.border : c.divider,
          shadowColor: c.shadow,
          shadowOpacity: dark || look.flat ? 0 : 0.045,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: dark || look.flat ? 0 : 1,
        };
    // 主视觉才上粗墨线 + 硬位移「贴纸影」
    const frameInk: ViewStyle = inkLook
      ? { borderWidth: 1.5, borderColor: ink.line, boxShadow: `0px 3px 0px ${dark ? '#000000' : ink.line}` }
      : frame;
    const scale = FONT_SCALE[ap.fontScale] ?? 1;
    const lh = LINE_HEIGHT[ap.lineHeight] ?? 1.8;
    const fs = (n: number) => Math.round(n * scale * 10) / 10;
    const fonts = resolveFontRoles(ap.fontFamily ?? 'serif', Platform.OS, fontsReady);
    const uiStyle: TextStyle = { fontFamily: fonts.ui, color: c.text };
    const readingTitle: TextStyle = { fontWeight: '600', ...resolveTextFont(fonts, 'reading', undefined, '600') };
    return {
      c, dark, scale, lineHeight: lh,
      contentWidth: Number.isFinite(ap.contentWidth) ? Math.max(0, Math.min(1, ap.contentWidth)) : 0.5,
      fs, look, r, frame, ink, frameInk, ui: fonts.ui, fonts, fontsReady,
      serif: fonts.reading, reading: fonts.reading, readingBold: fonts.readingBold,
      t: {
        // 大标题用阅读衬线字：杂志/日记感的关键视觉锚点（墨记、素忆、Day One 同款策略）
        display: { fontWeight: '600', fontSize: fs(30), lineHeight: fs(42), color: c.text, ...resolveTextFont(fonts, 'reading', undefined, '600') },
        h1: { fontWeight: '600', fontSize: fs(22), lineHeight: fs(32), color: c.text, ...resolveTextFont(fonts, 'reading', undefined, '600') },
        h2: { fontWeight: '600', fontSize: fs(18), lineHeight: fs(27), color: c.text, ...resolveTextFont(fonts, 'reading', undefined, '600') },
        h3: { ...uiStyle, fontWeight: '600', fontSize: fs(16), lineHeight: fs(24) },
        body: { ...uiStyle, fontSize: fs(15), lineHeight: fs(24) },
        readingTitle: { ...readingTitle, fontSize: fs(22), lineHeight: fs(34), color: c.text },
        bodySerif: { fontFamily: fonts.reading, fontSize: fs(16), color: c.text, lineHeight: fs(16) * lh },
        sub: { ...uiStyle, fontSize: fs(13), color: c.textSub, lineHeight: fs(21) },
        caption: { ...uiStyle, fontSize: fs(12), lineHeight: fs(19), color: c.textSub },
        tiny: { ...uiStyle, fontSize: fs(12), lineHeight: fs(18), color: c.textMuted },
      },
    };
  }, [dark, ap.accent, ap.style, ap.fontScale, ap.fontFamily, ap.lineHeight, ap.contentWidth, fontsReady]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--jide-focus-ring', theme.c.focusRing);
    }
  }, [theme.c.focusRing]);

  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeCtx);
  if (!theme) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
}

/** 当前主题风格对应的插画包（未配置的风格回退到线绘陪伴） */
export function useIllustrations() {
  const { look } = useTheme();
  return ILLUSTRATION_PACKS[look.key] ?? ILLUSTRATION_PACKS.companion;
}

export function useStyles<T>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
}
