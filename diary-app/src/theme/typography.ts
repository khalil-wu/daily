/** Font roles are independent of React Native so fallback and weight behavior can be verified. */
export type FontFamilyKey = 'serif' | 'sans' | 'kai';
export type TextRole = 'ui' | 'reading';

export interface FontRoles {
  ui: string;
  reading: string;
  readingBold?: string;
  native: boolean;
}

export function resolveFontRoles(family: FontFamilyKey, platform: string, fontsReady: boolean): FontRoles {
  const native = platform !== 'web';
  const ui = platform === 'web'
    ? '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif'
    : platform === 'ios' ? 'System' : 'sans-serif';
  if (family === 'sans') return { ui, reading: ui, native };
  if (family === 'kai') return {
    ui, native,
    reading: platform === 'web'
      ? '"Kaiti SC", "STKaiti", "KaiTi", "Songti SC", "Noto Serif CJK SC", serif'
      : platform === 'ios' ? 'Kaiti SC' : 'serif',
  };
  if (native && !fontsReady) return { ui, reading: ui, native };
  return {
    ui, native,
    reading: native ? 'NotoSerifSC' : '"NotoSerifSC", "Songti SC", "Noto Serif CJK SC", "STSong", Georgia, serif',
    readingBold: native ? 'NotoSerifSC-SemiBold' : '"NotoSerifSC-SemiBold", "NotoSerifSC", "Songti SC", "Noto Serif CJK SC", "STSong", Georgia, serif',
  };
}

export function resolveTextFont(
  fonts: FontRoles,
  role: TextRole,
  explicitFamily?: string,
  weight?: string | number,
): { fontFamily: string; fontWeight?: 'normal' } {
  const bold = weight === 'bold' || Number(weight) >= 600;
  const family = explicitFamily ?? (role === 'reading' ? fonts.reading : fonts.ui);
  const fontFamily = bold && fonts.readingBold && family === fonts.reading ? fonts.readingBold : family;
  // Native bundled font names identify a particular weight. Asking the OS to synthesize
  // another weight for that name can silently fall back to a different family.
  return fonts.native && fonts.readingBold && (fontFamily === fonts.reading || fontFamily === fonts.readingBold)
    ? { fontFamily, fontWeight: 'normal' }
    : { fontFamily };
}
