import React from 'react';
import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

/**
 * 线绘单色图标组件（用于底部导航与写作工具栏等 20-24px 图标槽）。
 * 通过 tintColor 跨 Web 与原生端动态适配深浅色与强调色。
 */
export function AssetIcon({
  source,
  size = 20,
  color,
  style,
}: {
  source: ImageSourcePropType;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={source}
      tintColor={color}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, ...(color ? { tintColor: color } : {}) }, style]}
    />
  );
}
