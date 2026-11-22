import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './text';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { useIllustrations, useTheme } from '../theme/ThemeProvider';
import { mixHex } from '../theme/palette';
import { Photo } from './ui';

/** 书脊封面：缝线段 + 松紧带 + 标签贴 + 最近照片拍立得 / 风格插画贴纸。active 由外层画书签带。 */
export function BookCover({
  color,
  name,
  count,
  photo,
  photoTilt = '-5deg',
  style,
}: {
  color: string;
  name: string;
  count: number;
  photo?: string;
  photoTilt?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, t, fs, r, ink, frameInk } = useTheme();
  const pack = useIllustrations();
  const spine = mixHex(color, '#000000', 0.18);
  const band = mixHex(color, '#000000', 0.28);
  return (
    <View
      style={[
        {
          aspectRatio: 3 / 4,
          borderTopLeftRadius: r(6),
          borderBottomLeftRadius: r(6),
          borderTopRightRadius: r(12),
          borderBottomRightRadius: r(12),
          overflow: 'hidden',
          backgroundColor: color,
        },
        ink.on ? frameInk : { boxShadow: '0px 6px 14px rgba(0,0,0,0.12)' },
        style,
      ]}
    >
      {/* 书脊缝线 */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, backgroundColor: spine }} />
      <View style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      <View style={{ position: 'absolute', left: 9, top: 6, bottom: 6, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      {/* 松紧带 */}
      <View style={{ position: 'absolute', right: '18%', top: 0, bottom: 0, width: 6, backgroundColor: band }} />
      {/* 封面光泽 */}
      <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.7 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {/* 标签贴：书脊右侧区域居中 */}
      <View style={{ position: 'absolute', top: '26%', left: 14, right: 0, alignItems: 'center' }} pointerEvents="none">
        <View
          style={{
            width: '76%',
            backgroundColor: '#FFFDF8',
            borderRadius: r(8),
            borderWidth: 1.25,
            borderColor: ink.on ? ink.line : c.border,
            paddingHorizontal: 10,
            paddingVertical: 8,
            alignItems: 'center',
          }}
        >
          <Text numberOfLines={2} style={[t.h2, { fontSize: fs(15), lineHeight: fs(20), color: '#1F2528', textAlign: 'center' }]}>{name}</Text>
          <Text style={{ fontSize: fs(11), color: '#545B60', marginTop: 3 }}>{count} 篇</Text>
        </View>
      </View>
      {photo ? (
        /* 最近照片拍立得 + 和纸胶带 */
        <View
          style={{
            position: 'absolute',
            right: 8,
            bottom: 10,
            width: 54,
            height: 62,
            backgroundColor: '#FFFDF8',
            padding: 4,
            paddingBottom: 12,
            transform: [{ rotate: photoTilt }],
            boxShadow: '0px 2px 0px rgba(0,0,0,0.18)',
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Photo uri={photo} style={{ flex: 1 }} radius={0} />
          <View style={{ position: 'absolute', top: -4, alignSelf: 'center', width: 16, height: 6, backgroundColor: 'rgba(255,255,255,0.7)', transform: [{ rotate: '-8deg' }] }} />
        </View>
      ) : (
        /* 风格插画贴纸 */
        <ExpoImage
          source={pack.memorySticker as any}
          style={{ position: 'absolute', right: 8, bottom: 8, width: 46, height: 46, transform: [{ rotate: '6deg' }] }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}

/** 「正在查看」书签带：顶边垂下的 V 形缺口丝带 */
export function BookRibbon({ color }: { color: string }) {
  return (
    <Svg pointerEvents="none" width={10} height={28} style={{ position: 'absolute', top: 0, left: 22, zIndex: 2 }}>
      <Polygon points="0,0 10,0 10,28 5,21 0,28" fill={color} />
    </Svg>
  );
}
