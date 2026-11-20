import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { ACCENTS, STYLES, type FontScaleKey, type StyleKey, type ThemeMode } from '../../src/theme/tokens';
import { Card, Group, NavBar, Row, Screen, haptic } from '../../src/components/ui';

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
  { key: 'system', label: '跟随系统' },
];

const FONT_SIZES: { key: FontScaleKey; label: string; sampleSize: number }[] = [
  { key: 'standard', label: '标准', sampleSize: 16 },
  { key: 'large', label: '较大', sampleSize: 19 },
  { key: 'xlarge', label: '更大', sampleSize: 22 },
];

/** 6. 外观主题（1:1 复刻设计稿3 #6） */
export default function AppearanceScreen() {
  const { c, t, fs } = useTheme();
  const ap = useStore(s => s.appearance);

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="外观主题" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        {/* 主题模式三卡片 */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          {THEMES.map(item => {
            const on = ap.theme === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  haptic('light');
                  actions.setAppearance({ theme: item.key });
                }}
                style={{
                  flex: 1,
                  backgroundColor: c.card,
                  borderRadius: 16,
                  padding: 10,
                  alignItems: 'center',
                  borderWidth: on ? 1.8 : StyleSheet.hairlineWidth,
                  borderColor: on ? c.primary : c.divider,
                }}
              >
                <View
                  style={{
                    width: '100%',
                    height: 62,
                    borderRadius: 10,
                    overflow: 'hidden',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: c.divider,
                    flexDirection: 'row',
                  }}
                >
                  {item.key === 'light' && <View style={{ flex: 1, backgroundColor: '#F8F5EF', padding: 8, gap: 5 }}><View style={{ width: '70%', height: 6, borderRadius: 3, backgroundColor: '#D6C8B8' }} /><View style={{ width: '50%', height: 5, borderRadius: 3, backgroundColor: '#E8DFD5' }} /></View>}
                  {item.key === 'dark' && <View style={{ flex: 1, backgroundColor: '#1E1A17', padding: 8, gap: 5 }}><View style={{ width: '70%', height: 6, borderRadius: 3, backgroundColor: '#665C53' }} /><View style={{ width: '50%', height: 5, borderRadius: 3, backgroundColor: '#3E3731' }} /></View>}
                  {item.key === 'system' && (
                    <>
                      <View style={{ flex: 1, backgroundColor: '#F8F5EF', padding: 6 }}><View style={{ width: '80%', height: 5, borderRadius: 3, backgroundColor: '#D6C8B8' }} /></View>
                      <View style={{ flex: 1, backgroundColor: '#1E1A17', padding: 6 }}><View style={{ width: '80%', height: 5, borderRadius: 3, backgroundColor: '#665C53' }} /></View>
                    </>
                  )}
                </View>
                <Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400', marginTop: 8 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 整体风格：配色基调 + 圆角与描边，选中时一并换上搭配的强调色 */}
        <Text style={{ fontSize: fs(14), color: c.text, fontWeight: '500', marginBottom: 12 }}>风格</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
          {STYLES.map(st => {
            const on = ap.style === st.key;
            const n = ap.theme === 'dark' ? st.dark : st.light;
            return (
              <Pressable
                key={st.key}
                onPress={() => {
                  haptic('light');
                  actions.setAppearance({ style: st.key as StyleKey, accent: st.accent });
                }}
                style={{
                  width: '30.8%',
                  backgroundColor: c.card,
                  borderRadius: 16,
                  padding: 8,
                  borderWidth: on ? 1.8 : StyleSheet.hairlineWidth,
                  borderColor: on ? c.primary : c.divider,
                }}
              >
                {/* 缩略预览：底色 + 卡片 + 一行文字 */}
                <View style={{ height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: n.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: n.divider, padding: 7 }}>
                  <View style={{ flex: 1, backgroundColor: n.card, borderRadius: Math.max(2, 8 * st.radius), borderWidth: st.flat ? 1 : 0, borderColor: n.border, padding: 6 }}>
                    <View style={{ width: '62%', height: 5, borderRadius: 3, backgroundColor: n.text, opacity: 0.75 }} />
                    <View style={{ width: '42%', height: 4, borderRadius: 2, backgroundColor: n.textMuted, marginTop: 5 }} />
                  </View>
                </View>
                <Text style={{ fontSize: fs(12.5), color: on ? c.primaryDark : c.text, fontWeight: on ? '600' : '500', marginTop: 7, textAlign: 'center' }}>
                  {st.name}
                </Text>
                <Text style={{ fontSize: fs(10), color: c.textMuted, marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
                  {st.desc}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 强调色 */}
        <Text style={{ fontSize: fs(14), color: c.text, fontWeight: '500', marginBottom: 12 }}>强调色</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4, marginBottom: 26 }}>
          {ACCENTS.map(ac => {
            const on = ap.accent === ac.key;
            return (
              <Pressable
                key={ac.key}
                onPress={() => {
                  haptic('light');
                  actions.setAppearance({ accent: ac.key });
                }}
                style={{ alignItems: 'center', gap: 6, width: 52 }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: ac.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: on ? 3 : 0,
                    borderColor: c.card,
                    shadowColor: ac.color,
                    shadowOpacity: on ? 0.5 : 0,
                    shadowRadius: 8,
                    elevation: on ? 3 : 0,
                  }}
                >
                  {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />}
                </View>
                <Text style={{ fontSize: fs(11.5), color: on ? c.text : c.textMuted }}>{ac.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 字体大小 */}
        <Text style={{ fontSize: fs(14), color: c.text, fontWeight: '500', marginBottom: 12 }}>字体大小</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {FONT_SIZES.map(f => {
            const on = ap.fontScale === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  haptic('light');
                  actions.setAppearance({ fontScale: f.key });
                }}
                style={{
                  flex: 1,
                  backgroundColor: on ? c.primaryFaint : c.card,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: on ? c.primary : c.divider,
                }}
              >
                <Text style={{ fontSize: f.sampleSize, color: on ? c.primaryDark : c.text, fontWeight: '600' }}>A</Text>
                <Text style={{ fontSize: fs(12), color: on ? c.primaryDark : c.textSub, marginTop: 4 }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 实时效果预览框 */}
        <Card style={{ marginBottom: 18 }}>
          <Text style={t.bodySerif}>
            这是正文示例文字，用来预览当前字体大小与排版效果。安静记录生活的每一刻。
          </Text>
        </Card>

        <Group>
          <Row title="字体与排版设置" subtitle="调整正文宽度、行距与卡片样式" onPress={() => router.push('/settings/typography')} />
        </Group>
      </ScrollView>
    </Screen>
  );
}
