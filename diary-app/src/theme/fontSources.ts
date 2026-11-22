import type { FontSource } from 'expo-font';

/** Native keeps the complete offline fonts bundled with the application. */
export const FONT_SOURCES: Record<string, FontSource> = {
  NotoSerifSC: require('../../assets/fonts/NotoSerifSC-Regular.otf'),
  'NotoSerifSC-SemiBold': require('../../assets/fonts/NotoSerifSC-SemiBold.otf'),
};
