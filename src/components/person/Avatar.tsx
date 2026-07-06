import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, strokeWidth, typography } from '@/src/theme';

type Props = {
  name: string;
  size: number;
  highlighted?: boolean;
  masked?: boolean;
  avatarUri?: string | null;
};

function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return colors.avatarTints[Math.abs(h) % colors.avatarTints.length];
}

export function Avatar({ name, size, highlighted, masked, avatarUri }: Props) {
  const glowSize = size * 1.35;
  const showImage = Boolean(avatarUri && !masked);

  return (
    <View style={{ width: size, height: size, opacity: masked ? 0.5 : 1 }}>
      {highlighted && !masked ? (
        <View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              left: (size - glowSize) / 2,
              top: (size - glowSize) / 2,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth.avatar,
          },
        ]}
      >
        {showImage ? (
          <Image source={{ uri: avatarUri ?? '' }} style={[styles.image, { borderRadius: size / 2 }]} />
        ) : (
          <View
            style={[
              styles.inner,
              { borderRadius: size / 2, backgroundColor: masked ? colors.bgWash : tintFor(name) },
            ]}
          >
            <Text style={[styles.text, { fontSize: size * 0.32 }]}>
              {masked ? '·' : name.slice(0, 1)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 纯 View 模拟光晕，iOS/Android 表现一致
  glow: {
    position: 'absolute',
    backgroundColor: colors.glow,
    opacity: 0.55,
  },
  outer: {
    borderColor: colors.stroke,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  text: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
