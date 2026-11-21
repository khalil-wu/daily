import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import type { FontFamilyKey, LineHeightKey } from '../../src/theme/tokens';
import { FONT_FAMILIES } from '../../src/theme/tokens';
import { Card, NavBar, Screen, haptic } from '../../src/components/ui';

const WIDTH_STOPS = [
  { val: 0, label: '窄' },
  { val: 0.5, label: '适中' },
  { val: 1, label: '宽' },
];

const LINE_OPTIONS: { key: LineHeightKey; label: string; gap: number }[] = [
  { key: 'compact', label: '紧凑', gap: 3 },
  { key: 'standard', label: '标准', gap: 5 },
  { key: 'relaxed', label: '舒适', gap: 7 },
];

/** 7. 字体与排版设置（1:1 复刻设计稿3 #7） */
export default function TypographyScreen() {
  const { c, t, fs, serif } = useTheme();
  const ap = useStore(s => s.appearance);
  const previewPad = Math.round(28 - ap.contentWidth * 16);

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="字体与排版" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, gap: 22 }}>
        {/* 字体 */}
        <View>
          <Text style={[t.h3, { fontSize: fs(15) }]}>字体</Text>
          <Text style={[t.sub, { marginTop: 4, marginBottom: 14 }]}>标题与阅读正文的字形</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {FONT_FAMILIES.map(opt => {
              const on = (ap.fontFamily ?? 'serif') === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    haptic('light');
                    actions.setAppearance({ fontFamily: opt.key as FontFamilyKey });
                  }}
                  accessibilityLabel={`字体：${opt.name}`}
                  style={{
                    flex: 1,
                    backgroundColor: on ? c.primaryFaint : c.card,
                    borderRadius: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: on ? c.primary : c.divider,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fs(22),
                      color: on ? c.primaryDark : c.text,
                      fontFamily: opt.key === 'serif' ? t.h1.fontFamily : opt.key === 'sans' ? undefined : serif,
                      fontWeight: opt.key === 'sans' ? '700' : '400',
                    }}
                  >
                    记得
                  </Text>
                  <Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400', marginTop: 10 }}>
                    {opt.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 正文宽度 */}
        <View>
          <Text style={[t.h3, { fontSize: fs(15) }]}>正文宽度</Text>
          <Text style={[t.sub, { marginTop: 4, marginBottom: 14 }]}>控制每篇日记的阅读宽度</Text>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 }}>
              <View style={{ position: 'absolute', left: 26, right: 26, height: 2, backgroundColor: c.divider }} />
              <View style={{ position: 'absolute', left: 26, width: `${ap.contentWidth * 82}%`, height: 2, backgroundColor: c.primary }} />
              {WIDTH_STOPS.map(stop => {
                const on = Math.abs(ap.contentWidth - stop.val) < 0.25;
                return (
                  <Pressable
                    key={stop.label}
                    hitSlop={14}
                    onPress={() => {
                      haptic('light');
                      actions.setAppearance({ contentWidth: stop.val });
                    }}
                    style={{ alignItems: 'center', gap: 8 }}
                  >
                    <View
                      style={{
                        width: on ? 18 : 12,
                        height: on ? 18 : 12,
                        borderRadius: 9,
                        backgroundColor: on ? c.primary : c.card,
                        borderWidth: 2,
                        borderColor: on ? c.primary : c.border,
                      }}
                    />
                    <Text style={{ fontSize: fs(12), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400' }}>{stop.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        {/* 行距 */}
        <View>
          <Text style={[t.h3, { fontSize: fs(15) }]}>行距</Text>
          <Text style={[t.sub, { marginTop: 4, marginBottom: 14 }]}>调整正文的行间距</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {LINE_OPTIONS.map(opt => {
              const on = ap.lineHeight === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    haptic('light');
                    actions.setAppearance({ lineHeight: opt.key });
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: on ? c.primaryFaint : c.card,
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: 'center',
                    borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: on ? c.primary : c.divider,
                  }}
                >
                  <View style={{ height: 28, justifyContent: 'center', gap: opt.gap }}>
                    <View style={{ width: 28, height: 2, borderRadius: 1, backgroundColor: on ? c.primaryDark : c.textSub }} />
                    <View style={{ width: 22, height: 2, borderRadius: 1, backgroundColor: on ? c.primaryDark : c.textSub }} />
                    <View style={{ width: 26, height: 2, borderRadius: 1, backgroundColor: on ? c.primaryDark : c.textSub }} />
                  </View>
                  <Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400', marginTop: 10 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 卡片样式 */}
        <View>
          <Text style={[t.h3, { fontSize: fs(15) }]}>卡片样式</Text>
          <Text style={[t.sub, { marginTop: 4, marginBottom: 14 }]}>日记列表的展示样式</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { key: 'simple' as const, label: '简洁卡片', hasImg: false },
              { key: 'image' as const, label: '图文卡片', hasImg: true },
            ].map(item => {
              const on = ap.cardStyle === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    haptic('light');
                    actions.setAppearance({ cardStyle: item.key });
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: on ? c.primaryFaint : c.card,
                    borderRadius: 16,
                    padding: 14,
                    alignItems: 'center',
                    borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: on ? c.primary : c.divider,
                  }}
                >
                  <View style={{ width: '100%', height: 54, borderRadius: 10, backgroundColor: c.card, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ width: '75%', height: 5, borderRadius: 3, backgroundColor: c.primarySoft }} />
                      <View style={{ width: '95%', height: 4, borderRadius: 2, backgroundColor: c.divider }} />
                      <View style={{ width: '60%', height: 4, borderRadius: 2, backgroundColor: c.divider }} />
                    </View>
                    {item.hasImg && <View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: c.primarySoft }} />}
                  </View>
                  <Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400', marginTop: 10 }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 实时预览 */}
        <Card style={{ paddingHorizontal: previewPad }}>
          <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginBottom: 6 }}>排版实时预览</Text>
          <Text style={t.bodySerif}>
            今天去了城郊的山林，空气非常清新。沿着小路慢慢走，太阳透过树叶洒下斑驳的光影，整个人都放松了很多。
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
