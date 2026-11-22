import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  BookMarked, BookOpen, Briefcase, Camera, Coffee, Dumbbell, Gift, Heart, HeartPulse,
  Home, Leaf, Moon, Music, Palette, Plane, Smile, Sprout, Star,
  Tag as TagLucide, Utensils, Wallet, type LucideIcon,
} from 'lucide-react-native';
import type { MoodKey, WeatherKey } from '../store/types';
import { MOOD_ICONS, WEATHER_ICONS } from '../data/assets';

export function MoodIcon({ mood, size = 28 }: { mood: MoodKey; size?: number }) {
  const src = MOOD_ICONS[mood] ?? MOOD_ICONS.calm;
  return (
    <Image
      source={src}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    />
  );
}

export function WeatherIcon({ weather, size = 18 }: { weather: WeatherKey; size?: number; color?: string }) {
  const src = WEATHER_ICONS[weather] ?? WEATHER_ICONS.sunny;
  const s = Math.max(size, 15);
  return (
    <Image
      source={src}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: s, height: s }}
    />
  );
}

const TAG_ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, Briefcase, Coffee, Plane, Heart, Sprout, BookMarked, Dumbbell, HeartPulse, Wallet,
  Music, Camera, Star, Smile, Home, Gift, Palette, Leaf, Moon, Utensils,
};

export function getTagIcon(name?: string): LucideIcon {
  return (name && TAG_ICON_MAP[name]) || TagLucide;
}

/** 登录/注册/找回密码页面右上角的淡雅植物枝条装饰 */
export function BotanicalAccent({ color = '#5AC4CA' }: { color?: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, opacity: 0.4 }}>
      <Svg width={132} height={132} viewBox="0 0 132 132">
        <Path d="M126 10 Q96 42 54 64" stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <Path d="M98 31 Q88 15 74 22 Q86 35 98 31 Z" fill={color} opacity={0.5} />
        <Path d="M84 44 Q102 52 94 67 Q79 56 84 44 Z" fill={color} opacity={0.45} />
        <Path d="M68 55 Q58 39 45 48 Q57 60 68 55 Z" fill={color} opacity={0.42} />
        <Path d="M110 21 Q124 31 116 44 Q105 32 110 21 Z" fill={color} opacity={0.35} />
      </Svg>
    </View>
  );
}
