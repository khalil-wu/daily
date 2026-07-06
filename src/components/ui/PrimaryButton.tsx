import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useRef } from 'react';

import { lightImpactFeedback, motion, useReducedMotion } from '@/src/motion';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type Variant = 'primary' | 'warm' | 'ghost' | 'pop';

type Props = {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  variant?: Variant;
};

const variantBg: Record<Variant, string> = {
  primary: colors.accent,
  warm: colors.secondary,
  pop: colors.accentPop,
  ghost: 'transparent',
};

const variantPressedBg: Record<Variant, string> = {
  primary: colors.accentDim,
  warm: colors.accentDim,
  pop: colors.accentDim,
  ghost: colors.bgWash,
};

export function PrimaryButton({ label, onPress, style, disabled, variant = 'primary' }: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (value: number) => {
    if (reducedMotion || disabled) return;
    Animated.spring(scale, {
      toValue: value,
      speed: motion.spring.tap.speed,
      bounciness: motion.spring.tap.bounciness,
      useNativeDriver: motion.useNativeDriver,
    }).start();
  };

  const isGhost = variant === 'ghost';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { void lightImpactFeedback(); animateScale(motion.pressScale); }}
      onPressOut={() => animateScale(1)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: variantBg[variant] },
        isGhost && styles.buttonGhost,
        pressed && !disabled && { backgroundColor: variantPressedBg[variant] },
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={[styles.label, isGhost && styles.labelGhost, disabled && styles.labelDisabled]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 168,
    height: 54,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    borderWidth: strokeWidth.button,
    borderColor: colors.stroke,
    ...shadows.accent,
  },
  buttonGhost: {
    borderWidth: strokeWidth.button,
    borderColor: colors.stroke,
    ...shadows.card,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  // 漫画风按钮文字用深色（accent/secondary/pop 均为浅色底，深字对比度更高）
  label: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '700',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  labelGhost: {
    color: colors.textPrimary,
  },
  labelDisabled: {
    color: colors.textTertiary,
  },
});
