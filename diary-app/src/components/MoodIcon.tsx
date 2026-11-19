import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  BookMarked, BookOpen, Briefcase, Camera, Cloud, CloudDrizzle, CloudLightning,
  CloudRain, CloudRainWind, CloudSun, Coffee, Dumbbell, Gift, Heart, HeartPulse,
  Home, Leaf, Moon, Music, Palette, Plane, Smile, Snowflake, Sprout, Star, Sun,
  Tag as TagLucide, Utensils, Wallet, type LucideIcon,
} from 'lucide-react-native';
import type { MoodKey, WeatherKey } from '../store/types';
import { moodMeta, weatherMeta } from '../data/constants';

export function MoodIcon({ mood, size = 28 }: { mood: MoodKey; size?: number }) {
  const m = moodMeta(mood);
  const fill = m?.color ?? '#E8D9C9';
  const stroke = '#5A4A3E';
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Circle cx={18} cy={18} r={16} fill={fill} opacity={0.92} />
      {mood === 'happy' && (
        <>
          <Circle cx={13} cy={15} r={1.6} fill={stroke} />
          <Circle cx={23} cy={15} r={1.6} fill={stroke} />
          <Path d="M12.5 21.5 Q18 26.5 23.5 21.5" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'calm' && (
        <>
          <Path d="M11 15.5 Q13 13.8 15 15.5" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Path d="M21 15.5 Q23 13.8 25 15.5" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Path d="M14 22 Q18 24.5 22 22" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'tired' && (
        <>
          <Path d="M11 16 L15 16" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" />
          <Path d="M21 16 L25 16" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" />
          <Path d="M14.5 23 Q18 21.5 21.5 23" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'down' && (
        <>
          <Circle cx={13} cy={15.5} r={1.5} fill={stroke} />
          <Circle cx={23} cy={15.5} r={1.5} fill={stroke} />
          <Path d="M13 24 Q18 19.5 23 24" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'anxious' && (
        <>
          <Path d="M11 14 L15 15.5" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M25 14 L21 15.5" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
          <Circle cx={13} cy={17.5} r={1.3} fill={stroke} />
          <Circle cx={23} cy={17.5} r={1.3} fill={stroke} />
          <Path d="M12.5 23 Q14.5 21.5 16.2 23 T19.8 23 T23.5 23" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'grateful' && (
        <>
          <Path d="M11 15.5 Q13 13.5 15 15.5" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" fill="none" />
          <Path d="M21 15.5 Q23 13.5 25 15.5" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" fill="none" />
          <Circle cx={10.5} cy={19.5} r={2} fill="#E07D73" opacity={0.45} />
          <Circle cx={25.5} cy={19.5} r={2} fill="#E07D73" opacity={0.45} />
          <Path d="M13.5 21.5 Q18 25.5 22.5 21.5" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" fill="none" />
        </>
      )}
    </Svg>
  );
}

const WEATHER_ICON_MAP: Record<string, LucideIcon> = {
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  Snowflake,
  CloudLightning,
};

export function WeatherIcon({ weather, size = 18, color }: { weather: WeatherKey; size?: number; color?: string }) {
  const meta = weatherMeta(weather);
  const Icon = (meta && WEATHER_ICON_MAP[meta.icon]) || Sun;
  return <Icon size={size} color={color ?? meta?.color ?? '#E2A65A'} strokeWidth={1.8} />;
}

const TAG_ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, Briefcase, Coffee, Plane, Heart, Sprout, BookMarked, Dumbbell, HeartPulse, Wallet,
  Music, Camera, Star, Smile, Home, Gift, Palette, Leaf, Moon, Utensils,
};

export function getTagIcon(name?: string): LucideIcon {
  return (name && TAG_ICON_MAP[name]) || TagLucide;
}

/** 登录/注册/找回密码页面右上角的淡雅植物枝条装饰（对应设计稿1 #6-#8） */
export function BotanicalAccent({ color = '#C8B09A' }: { color?: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, opacity: 0.45 }}>
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
