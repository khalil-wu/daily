import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing, strokeWidth } from '@/src/theme';

type Props = PropsWithChildren<{ style?: ViewStyle }>;

export function SectionCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
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
});
