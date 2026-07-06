import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing, strokeWidth } from '@/src/theme';

type Variant = 'card' | 'panel';

type Props = PropsWithChildren<{ style?: ViewStyle; variant?: Variant }>;

/** SectionCard — 日漫贴纸卡 / 分镜面板容器 */
export function SectionCard({ children, style, variant = 'card' }: Props) {
  return <View style={[styles.card, variant === 'panel' && styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    ...shadows.card,
  },
  // 漫画分镜面板：更粗的墨线 + 更大圆角 + 强投影
  panel: {
    borderWidth: strokeWidth.heavy,
    borderRadius: radius.card + 4,
    ...shadows.accent,
  },
});
