import { Platform } from 'react-native';

import { spacing } from './tokens';

export function getViewportWidth(windowWidth: number) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const documentWidth = document.documentElement.clientWidth || windowWidth;
    const innerWidth = typeof window !== 'undefined' ? window.innerWidth : windowWidth;
    return Math.max(0, Math.min(windowWidth, documentWidth, innerWidth));
  }

  return Math.max(0, windowWidth);
}

export function getContentWidth(
  windowWidth: number,
  options: { maxWidth?: number; gutter?: number } = {},
) {
  const maxWidth = options.maxWidth ?? 720;
  const gutter = options.gutter ?? spacing.xl;
  const viewportWidth = getViewportWidth(windowWidth);

  return Math.max(0, Math.min(viewportWidth, maxWidth) - gutter * 2);
}

export function getResponsiveColumnWidth(
  contentWidth: number,
  options: { gap?: number; minColumnWidth?: number } = {},
) {
  const gap = options.gap ?? spacing.lg;
  const minColumnWidth = options.minColumnWidth ?? 156;
  const canUseTwoColumns = contentWidth >= minColumnWidth * 2 + gap;

  if (!canUseTwoColumns) return contentWidth;
  return Math.floor((contentWidth - gap) / 2);
}
