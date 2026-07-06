import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { PersonSummary } from '@/src/data/mock';
import { motion, useReducedMotion } from '@/src/motion';
import { alpha, colors, radius, spacing, strokeWidth, typography } from '@/src/theme';
import { Avatar } from '@/src/components/person/Avatar';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';

type Props = {
  person: PersonSummary | null;
  onClose: () => void;
};

export function PersonSheet({ person, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const slide = useRef(new Animated.Value(400)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const visible = person !== null;

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      if (reducedMotion) {
        slide.setValue(0);
        backdrop.setValue(1);
        return;
      }
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: motion.duration.sheetIn,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: motion.useNativeDriver,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: motion.duration.sheetIn,
          useNativeDriver: motion.useNativeDriver,
        }),
      ]).start();
    }
  }, [visible, slide, backdrop, dragY, reducedMotion]);

  const close = () => {
    if (reducedMotion) {
      onClose();
      return;
    }
    Animated.parallel([
      Animated.timing(slide, { toValue: 400, duration: motion.duration.sheetOut, easing: Easing.in(Easing.cubic), useNativeDriver: motion.useNativeDriver }),
      Animated.timing(backdrop, { toValue: 0, duration: motion.duration.sheetOut, easing: Easing.in(Easing.cubic), useNativeDriver: motion.useNativeDriver }),
    ]).start(() => onClose());
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          close();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: motion.useNativeDriver, ...motion.spring.drag }).start();
        }
      },
    }),
  ).current;

  if (!person) return null;

  const isFemaleWord = ['母亲', '外婆', '恋人'].includes(person.relation) ? '她' : person.relation === '自己' ? '自己' : '他';
  const pronoun = person.name === '妈妈' || person.name === '外婆' ? '她' : isFemaleWord;
  const empty = person.memoryCount === 0;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: Animated.add(slide, dragY) }] }]}
        {...pan.panHandlers}
      >
        <View style={styles.handle} />

        <Avatar name={person.name} size={64} highlighted={person.recent} avatarUri={person.avatarUri} />
        <Text style={styles.name}>{person.name}</Text>
        <Text style={styles.note}>{person.note}</Text>

        {empty ? (
          <Text style={styles.meta}>这里还很安静，写下一件关于{pronoun}的小事。</Text>
        ) : (
          <Text style={styles.meta}>
            {person.memoryCount} 条记忆 · 最近一次 {person.lastDate}
          </Text>
        )}

        <View style={styles.buttons}>
          <PrimaryButton
            label={`写下关于${pronoun}`}
            onPress={() => {
              close();
              router.push({ pathname: '/memory/create', params: { personId: person.id, personName: person.name } });
            }}
          />
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
            onPress={() => {
              close();
              router.push(`/person/${person.id}`);
            }}
          >
            <Text style={styles.secondaryText}>看看{pronoun}的时间线</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.giant,
    alignItems: 'center',
    gap: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '500',
    lineHeight: typography.lineHeights.titleLg,
    marginTop: spacing.xs,
    includeFontPadding: false,
  },
  note: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
  },
  meta: {
    color: colors.textTertiary,
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  secondary: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPressed: {
    backgroundColor: alpha.accent8,
  },
  secondaryText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
