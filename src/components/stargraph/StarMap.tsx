import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

import { PersonSummary } from '@/src/data/mock';
import { motion, useReducedMotion } from '@/src/motion';
import { colors, spacing, typography } from '@/src/theme';
import { Avatar } from '@/src/components/person/Avatar';
import { computeLayout } from './layout';

type Props = {
  people: PersonSummary[];
  onPressPerson: (person: PersonSummary) => void;
  onPressSelf?: () => void;
  focusedId?: string | null;
  entering?: boolean;
};

const GRAPH_HEIGHT = 400;

function FloatingNode({
  children,
  seed,
  x,
  y,
  size,
  onPress,
  dimmed,
}: {
  children: React.ReactNode;
  seed: number;
  x: number;
  y: number;
  size: number;
  onPress?: () => void;
  dimmed?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const float = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(dimmed ? 0.4 : 1)).current;

  useEffect(() => {
    if (reducedMotion) {
      float.setValue(0);
      return undefined;
    }
    const duration = 4000 + (seed % 4) * 800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.useNativeDriver,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.useNativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, seed, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(dimmed ? 0.4 : 1);
      return undefined;
    }
    Animated.timing(opacity, {
      toValue: dimmed ? 0.4 : 1,
      duration: motion.duration.base,
      useNativeDriver: motion.useNativeDriver,
    }).start();
  }, [dimmed, opacity, reducedMotion]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [-motion.floatOffset, motion.floatOffset],
  });

  return (
    <Animated.View
      style={[
        styles.node,
        {
          left: x - size / 2,
          top: y - size / 2,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable onPress={onPress} hitSlop={8} style={styles.pressable}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function BreathingGlow({ size }: { size: number }) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.2)).current;
  const glowSize = size * 1.55;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.2);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.useNativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.selfGlow,
        {
          width: glowSize,
          height: glowSize,
          borderRadius: glowSize / 2,
          left: (size - glowSize) / 2,
          top: (size - glowSize) / 2,
          opacity,
        },
      ]}
    />
  );
}

export const StarMap = memo(function StarMap({ people, onPressPerson, onPressSelf, focusedId, entering }: Props) {
  const [width, setWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const transform = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      transform.setValue(0);
      return;
    }
    Animated.spring(transform, {
      toValue: entering ? 1 : 0,
      speed: motion.spring.sheet.speed,
      bounciness: motion.spring.sheet.bounciness,
      useNativeDriver: motion.useNativeDriver,
    }).start();
  }, [entering, reducedMotion, transform]);

  const scale = transform.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const dragRotate = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_, g) => {
        if (reducedMotion) return;
        dragRotate.setValue(g.dx * 0.3);
      },
      onPanResponderRelease: () => {
        if (reducedMotion) return;
        Animated.spring(dragRotate, {
          toValue: 0,
          ...motion.spring.drag,
          useNativeDriver: motion.useNativeDriver,
        }).start();
      },
      onPanResponderTerminate: () => {
        if (reducedMotion) return;
        Animated.spring(dragRotate, {
          toValue: 0,
          ...motion.spring.drag,
          useNativeDriver: motion.useNativeDriver,
        }).start();
      },
    }),
  ).current;

  const rotate = dragRotate.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] });

  const layout = useMemo(
    () => (width > 0 ? computeLayout(people, width, GRAPH_HEIGHT) : null),
    [people, width],
  );

  const haloRadius = layout ? Math.min(layout.width, layout.height) * 0.5 : 0;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ scale }, { rotate }] }]}
      {...pan.panHandlers}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {layout ? (
        <>
          <Svg width={layout.width} height={layout.height} style={styles.canvas}>
            <Defs>
              <RadialGradient
                id="centerHalo"
                cx={layout.centerX}
                cy={layout.centerY}
                r={haloRadius}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.16} />
                <Stop offset="55%" stopColor={colors.accent} stopOpacity={0.06} />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>

            <Rect x={0} y={0} width={layout.width} height={layout.height} fill="url(#centerHalo)" />

            {layout.nodes.map(({ person, x, y, size }) => {
              const angle = Math.atan2(y - layout.centerY, x - layout.centerX);
              const startGap = layout.centerSize / 2 + 8;
              const endGap = size / 2 + 8;
              const x1 = layout.centerX + Math.cos(angle) * startGap;
              const y1 = layout.centerY + Math.sin(angle) * startGap;
              const x2 = x - Math.cos(angle) * endGap;
              const y2 = y - Math.sin(angle) * endGap;
              return (
                <Fragment key={person.id}>
                  <Line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={colors.strokeSoft}
                    strokeOpacity={0.7}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                </Fragment>
              );
            })}

            {layout.nodes.flatMap(({ person, x, y, size }) =>
              Array.from({ length: Math.min(person.stars, 2) }).map((_, index) => (
                <Circle
                  key={`${person.id}-dot-${index}`}
                  cx={x + (size / 2 + 10) * Math.cos(-0.7 - index * 1.1)}
                  cy={y + (size / 2 + 10) * Math.sin(-0.7 - index * 1.1)}
                  r={3.4}
                  fill={colors.secondary}
                  stroke={colors.stroke}
                  strokeWidth={1.2}
                  opacity={0.95}
                />
              )),
            )}
          </Svg>

          <FloatingNode seed={0} x={layout.centerX} y={layout.centerY} size={layout.centerSize} onPress={onPressSelf} dimmed={Boolean(focusedId)}>
            <BreathingGlow size={layout.centerSize} />
            <Avatar name="我" size={layout.centerSize} highlighted />
            <Text style={styles.centerLabel}>我</Text>
          </FloatingNode>

          {layout.nodes.map(({ person, x, y, size }, index) => (
            <FloatingNode
              key={person.id}
              seed={index + 1}
              x={x}
              y={y}
              size={size}
              onPress={() => onPressPerson(person)}
              dimmed={Boolean(focusedId && focusedId !== person.id)}
            >
              <Avatar name={person.name} size={size} highlighted={person.recent} masked={person.isMasked} avatarUri={person.avatarUri} />
              <Text style={styles.label} numberOfLines={1}>
                {person.name}
              </Text>
            </FloatingNode>
          ))}
        </>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: GRAPH_HEIGHT,
    marginTop: spacing.sm,
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  node: {
    position: 'absolute',
    alignItems: 'center',
  },
  pressable: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  selfGlow: {
    position: 'absolute',
    backgroundColor: colors.glow,
  },
  centerLabel: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '500',
    maxWidth: 84,
    textAlign: 'center',
    includeFontPadding: false,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '500',
    maxWidth: 84,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
