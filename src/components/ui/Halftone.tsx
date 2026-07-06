import { Platform, View, type ViewStyle } from 'react-native';

import { colors } from '@/src/theme';

type HalftoneProps = {
  /** 0–1，控制网点不透明度 */
  intensity?: number;
  /** 网点直径 px（仅 Web 生效） */
  dotSize?: number;
  /** 网点间距 px（仅 Web 生效） */
  gap?: number;
  /** 网点颜色，默认使用墨线色 */
  color?: string;
  style?: ViewStyle;
};

/**
 * 日漫网点（halftone）背景层。
 * Web 用 radial-gradient 重复背景实现真网点；Native 退化为纯色半透明叠层。
 */
export function Halftone({
  intensity = 0.08,
  dotSize = 2,
  gap = 8,
  color,
  style,
}: HalftoneProps) {
  const c = color ?? colors.stroke;

  const baseStyle: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    ...style,
  };

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          ...baseStyle,
          // @ts-expect-error web-only CSS property
          backgroundImage: `radial-gradient(circle, ${c} ${dotSize}px, transparent ${dotSize + 0.5}px)`,
          backgroundSize: `${gap * 2}px ${gap * 2}px`,
          opacity: intensity,
        }}
      />
    );
  }

  // Native: 退化为纯色半透明叠层
  return <View style={{ ...baseStyle, backgroundColor: c, opacity: intensity * 0.4 }} />;
}

/**
 * 漫画速度线（放射线）装饰层。
 * 仅 Web 渲染；Native 返回 null（保持轻量）。
 */
export function SpeedLines({
  intensity = 0.05,
  style,
}: {
  intensity?: number;
  style?: ViewStyle;
}) {
  if (Platform.OS !== 'web') return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        // @ts-expect-error web-only CSS property
        backgroundImage: `repeating-conic-gradient(from 0deg, ${colors.stroke} 0deg 0.4deg, transparent 0.4deg 7deg)`,
        opacity: intensity,
        ...style,
      }}
    />
  );
}
