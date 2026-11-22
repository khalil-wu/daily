import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import type { FontFamilyKey, LineHeightKey } from '../../src/theme/tokens';
import { FONT_FAMILIES, resolveFontRoles, resolveTextFont } from '../../src/theme/tokens';
import { Card, NavBar, Screen, haptic, webSpaceAction } from '../../src/components/ui';

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
  const { c, t, fs, r, fontsReady, contentWidth } = useTheme();
  const ap = useStore(s => s.appearance);
  const previewPad = Math.round(28 - contentWidth * 16);
  const selectedWidth = WIDTH_STOPS.reduce((best, stop) => Math.abs(stop.val - contentWidth) < Math.abs(best.val - contentWidth) ? stop : best).val;

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar variant="large" title="字体与排版" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, gap: 22 }}>
        {/* 字体 */}
        <View>
          <Text style={[t.h3, { fontSize: fs(15) }]}>日记阅读字体</Text>
          <Text style={[t.sub, { marginTop: 4, marginBottom: 14 }]}>用于日记标题、正文与内容摘要。导航、按钮、表单和数字使用系统字体。</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {FONT_FAMILIES.map(opt => {
              const on = (ap.fontFamily ?? 'serif') === opt.key;
              const sampleFont = resolveTextFont(resolveFontRoles(opt.key, Platform.OS, fontsReady), 'reading', undefined, '600');
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    haptic('light');
                    actions.setAppearance({ fontFamily: opt.key as FontFamilyKey });
                  }}
                  accessibilityLabel={`字体：${opt.name}`}
                  {...webSpaceAction(() => actions.setAppearance({ fontFamily: opt.key }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                    aria-checked={on}
                  style={{
                    flex: 1,
                    backgroundColor: on ? c.primaryFaint : c.card,
                    borderRadius: r(16),
                    paddingVertical: 16,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: on ? c.primaryDark : c.divider,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fs(22),
                      color: on ? c.primaryDark : c.text,
                      fontWeight: '600',
                      ...sampleFont,
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
          <Text style={[t.caption, { marginTop: 10 }]}>{Platform.OS === 'android' ? '楷体在此设备使用系统衬线字体；内置宋体加载完成前使用系统字体。' : '楷体优先使用设备可用的楷体字形；字体不可用时自动回退，记录仍可继续。'}</Text>
        </View>

        {/* 正文宽度 */}
        <View>
          <Text style={[t.h3, { fontSize: fs(15) }]}>正文宽度</Text>
          <Text style={[t.sub, { marginTop: 4, marginBottom: 14 }]}>控制每篇日记的阅读宽度</Text>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {WIDTH_STOPS.map(stop => {
                const on = selectedWidth === stop.val;
                return (
                  <Pressable
                    key={stop.label}
                    accessibilityRole="radio"
                    accessibilityLabel={`正文宽度：${stop.label}`}
                    {...webSpaceAction(() => actions.setAppearance({ contentWidth: stop.val }))}
                    accessibilityState={{ checked: on }}
                    aria-checked={on}
                    hitSlop={14}
                    onPress={() => {
                      haptic('light');
                      actions.setAppearance({ contentWidth: stop.val });
                    }}
                    style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: on ? c.primaryFaint : 'transparent', borderRadius: r(10), paddingVertical: 10 }}
                  >
                    <View
                      style={{
                        width: on ? 18 : 12,
                        height: on ? 18 : 12,
                        borderRadius: 9,
                        backgroundColor: on ? c.primary : c.card,
                        borderWidth: 2,
                        borderColor: on ? c.primaryDark : c.controlBorder,
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
                  accessibilityRole="radio"
                  accessibilityLabel={`行距：${opt.label}`}
                  {...webSpaceAction(() => actions.setAppearance({ lineHeight: opt.key }))}
                  accessibilityState={{ checked: on }}
                    aria-checked={on}
                  onPress={() => {
                    haptic('light');
                    actions.setAppearance({ lineHeight: opt.key });
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: on ? c.primaryFaint : c.card,
                    borderRadius: r(16),
                    paddingVertical: 16,
                    alignItems: 'center',
                    borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: on ? c.primaryDark : c.divider,
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
                  accessibilityRole="radio"
                  {...webSpaceAction(() => actions.setAppearance({ cardStyle: item.key }))}
                  accessibilityState={{ checked: on }}
                    aria-checked={on}
                  onPress={() => {
                    haptic('light');
                    actions.setAppearance({ cardStyle: item.key });
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: on ? c.primaryFaint : c.card,
                    borderRadius: r(16),
                    padding: 14,
                    alignItems: 'center',
                    borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: on ? c.primaryDark : c.divider,
                  }}
                >
                  <View style={{ width: '100%', height: 54, borderRadius: r(10), backgroundColor: c.card, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ width: '75%', height: 5, borderRadius: 3, backgroundColor: c.primarySoft }} />
                      <View style={{ width: '95%', height: 4, borderRadius: 2, backgroundColor: c.divider }} />
                      <View style={{ width: '60%', height: 4, borderRadius: 2, backgroundColor: c.divider }} />
                    </View>
                    {item.hasImg && <View style={{ width: 32, height: 32, borderRadius: r(6), backgroundColor: c.primarySoft }} />}
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
          <Text style={{ fontSize: fs(12), color: c.textMuted, marginBottom: 6 }}>排版实时预览</Text>
          <Text style={[t.readingTitle, { marginBottom: 12 }]}>把平凡的一天，慢慢记住</Text>
          <Text style={t.bodySerif}>今天去了城郊的山林，空气非常清新。沿着小路慢慢走，太阳透过树叶洒下斑驳的光影，整个人都放松了很多。</Text>
          <Text style={[t.bodySerif, { marginTop: 14 }]}>「記得當時的心情」，也记得回家的路。下午 3:30，写下“Take it slow.”——普通的一天，也值得认真留下来。</Text>
          <View style={{ borderTopWidth: 1, borderTopColor: c.divider, marginTop: 18, paddingTop: 14 }}>
            <Text style={t.h3}>界面字体预览</Text>
            <Text style={[t.sub, { marginTop: 6 }]}>保存日记 · 取消 · 2026年11月21日</Text>
            <Text style={[t.caption, { marginTop: 6 }]}>阅读字体只改变日记内容，这些控件文字保持系统字体。</Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
