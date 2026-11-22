import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { ILLUSTRATION_PACKS } from '../../src/data/assets';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ThemePreview } from '../../src/theme/ThemePreview';
import { actions, useStore } from '../../src/store/store';
import { ACCENTS, STYLES, buildPalette, scaleRadius, type FontScaleKey, type Palette, type StylePreset, type ThemeMode } from '../../src/theme/tokens';
import { Group, NavBar, Row, Screen, haptic, webSpaceAction } from '../../src/components/ui';

const THEMES: { key: ThemeMode; label: string }[] = [{ key: 'light', label: '浅色' }, { key: 'dark', label: '深色' }, { key: 'system', label: '跟随系统' }];
const FONT_SIZES: { key: FontScaleKey; label: string; sampleSize: number }[] = [{ key: 'standard', label: '标准', sampleSize: 16 }, { key: 'large', label: '较大', sampleSize: 19 }, { key: 'xlarge', label: '更大', sampleSize: 22 }];

function PaletteSample({ palette: p, look }: { palette: Palette; look: StylePreset }) {
  return <View importantForAccessibility="no-hide-descendants" aria-hidden style={{ flex: 1, backgroundColor: p.bg, padding: 7, gap: 5 }}>
    <View style={{ flex: 1, backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: scaleRadius(10, look), padding: 6, gap: 5 }}>
      <View style={{ width: '70%', height: 4, backgroundColor: p.text, borderRadius: 2 }} /><View style={{ width: '90%', height: 3, backgroundColor: p.textSub, borderRadius: 2 }} />
      <View style={{ alignSelf: 'flex-end', width: 20, height: 8, backgroundColor: p.primary, borderRadius: scaleRadius(999, look) }} />
    </View>
  </View>;
}

export default function AppearanceScreen() {
  const { c, t, fs, r, dark, look, frame } = useTheme();
  const ap = useStore(s => s.appearance);
  const lightPalette = buildPalette(false, ap.accent, look.key);
  const darkPalette = buildPalette(true, ap.accent, look.key);
  return <Screen enter="page" edges={['top', 'bottom']}>
    <NavBar variant="large" title="外观主题" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, gap: 24 }}>
      <View style={{ gap: 12 }}><Text style={t.h3}>显示模式</Text><View style={{ flexDirection: 'row', gap: 8 }}>
        {THEMES.map(item => { const on = ap.theme === item.key; return <Pressable key={item.key} accessibilityRole="radio" accessibilityLabel={`显示模式：${item.label}`} accessibilityState={{ checked: on }} aria-checked={on} {...webSpaceAction(() => actions.setAppearance({ theme: item.key }))} onPress={() => { haptic('light'); actions.setAppearance({ theme: item.key }); }} style={{ flex: 1, backgroundColor: c.card, borderRadius: r(16), padding: 8, borderWidth: on ? 2 : 1, borderColor: on ? c.primaryDark : c.divider }}>
          <View style={{ height: 66, overflow: 'hidden', borderRadius: r(10), flexDirection: 'row' }}>
            {item.key !== 'dark' && <PaletteSample palette={lightPalette} look={look} />}{item.key !== 'light' && <PaletteSample palette={darkPalette} look={look} />}
          </View><Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400', textAlign: 'center', marginTop: 8 }}>{item.label}</Text>
        </Pressable>; })}
      </View><Text style={t.caption}>{ap.theme === 'system' ? `当前跟随系统使用${dark ? '深色' : '浅色'}。` : '显示模式会应用到所有页面与弹层。'}</Text></View>
      <View style={{ gap: 12 }}><Text style={t.h3}>整体风格</Text><Text style={t.sub}>纸面、卡片、圆角与描边一起变化。选择风格会应用搭配的强调色，之后仍可单独调整。</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{STYLES.map(st => { const on = ap.style === st.key; const p = buildPalette(dark, on ? ap.accent : st.accent, st.key); return <Pressable key={st.key} accessibilityRole="radio" accessibilityLabel={`风格：${st.name}`} accessibilityHint={st.desc} accessibilityState={{ checked: on }} aria-checked={on} {...webSpaceAction(() => actions.setAppearance({ style: st.key, accent: st.accent }))} onPress={() => { haptic('light'); actions.setAppearance({ style: st.key, accent: st.accent }); }} style={{ flexBasis: '30%', flexGrow: 1, minWidth: 114, backgroundColor: c.card, borderRadius: r(16), padding: 9, borderWidth: on ? 2 : 1, borderColor: on ? c.primaryDark : c.divider }}>
          <View style={{ height: 72, borderRadius: scaleRadius(12, st), overflow: 'hidden', flexDirection: 'row', alignItems: 'center' }}><PaletteSample palette={p} look={st} /><ExpoImage source={ILLUSTRATION_PACKS[st.key].emptyBook as any} style={{ width: 44, height: 44, marginRight: 6 }} contentFit="contain" transition={0} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 9 }}><Text style={{ fontSize: fs(14), color: on ? c.primaryDark : c.text, fontWeight: '600' }}>{st.name}</Text>{on && <Check size={14} color={c.primaryDark} />}</View>
          <Text style={{ fontSize: fs(12), lineHeight: fs(18), color: c.textSub, textAlign: 'center', marginTop: 4 }}>{st.desc}</Text>
        </Pressable>; })}</View>
      </View>
      <View style={{ gap: 12 }}><Text style={t.h3}>强调色</Text><Text style={t.sub}>用于主要操作与选中状态；心情颜色保持原有含义。</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{ACCENTS.map(ac => { const on = ap.accent === ac.key; const p = buildPalette(dark, ac.key, look.key); return <Pressable key={ac.key} accessibilityRole="radio" accessibilityLabel={`强调色：${ac.name}`} accessibilityState={{ checked: on }} aria-checked={on} {...webSpaceAction(() => actions.setAppearance({ accent: ac.key }))} onPress={() => { haptic('light'); actions.setAppearance({ accent: ac.key }); }} style={{ minWidth: 46, paddingVertical: 4, alignItems: 'center', gap: 6 }}>
        <View style={{ width: 44, height: 44, borderRadius: r(999), backgroundColor: p.primary, borderWidth: on ? 2 : 1, borderColor: on ? c.text : c.controlBorder, alignItems: 'center', justifyContent: 'center' }}>{on && <Check size={22} color={p.textOnPrimary} strokeWidth={2.5} />}</View><Text style={{ fontSize: fs(12), color: on ? c.text : c.textSub }}>{ac.name}</Text>
      </Pressable>; })}</View></View>
      <View style={{ gap: 12 }}><Text style={t.h3}>文字大小</Text><Text style={t.sub}>同时调整界面与日记正文的文字大小。</Text><View style={{ flexDirection: 'row', gap: 8 }}>{FONT_SIZES.map(opt => { const on = ap.fontScale === opt.key; return <Pressable key={opt.key} accessibilityRole="radio" accessibilityLabel={`文字大小：${opt.label}`} accessibilityState={{ checked: on }} aria-checked={on} {...webSpaceAction(() => actions.setAppearance({ fontScale: opt.key }))} onPress={() => { haptic('light'); actions.setAppearance({ fontScale: opt.key }); }} style={{ flex: 1, backgroundColor: on ? c.primaryFaint : c.card, borderRadius: r(14), paddingVertical: 14, paddingHorizontal: 5, alignItems: 'center', borderWidth: on ? 2 : 1, borderColor: on ? c.primaryDark : c.divider }}><Text style={{ fontSize: opt.sampleSize, color: c.text, fontWeight: '600' }}>Aa 字</Text><Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, marginTop: 7 }}>{opt.label}</Text></Pressable>; })}</View></View>
      <View style={{ borderRadius: r(18), padding: 14, backgroundColor: c.bgDeep, ...frame }}><ThemePreview /></View>
      <Group><Row title="字体与排版" subtitle="日记阅读字体、行距、正文宽度与卡片样式" onPress={() => router.push('/settings/typography')} /></Group>
    </ScrollView>
  </Screen>;
}
