import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { Check, ChevronRight, LockKeyhole } from 'lucide-react-native';
import { Text } from '../components/text';
import { Card, Segmented } from '../components/ui';
import { MoodIcon } from '../components/MoodIcon';
import { PHOTO_ASSETS } from '../data/assets';
import { useTheme } from './ThemeProvider';

/** The same content is used for every look, accent, font and mode. No user diary is read. */
export function ThemePreview() {
  const { c, t, r, fs, contentWidth } = useTheme();
  const [page, setPage] = useState<'entries' | 'reading' | 'controls'>('entries');
  return <View style={{ gap: 12 }}>
    <Text style={t.h3}>效果预览</Text>
    <Segmented items={[{ key: 'entries', label: '记录' }, { key: 'reading', label: '阅读' }, { key: 'controls', label: '控件' }]} value={page} onChange={setPage} />
    <Text style={t.caption}>以下为示例内容，随当前设置即时变化。</Text>
    {page === 'entries' && <View style={{ gap: 12 }}>
      <Card><Text style={t.caption}>11月21日 · 08:30</Text><Text textRole="reading" style={{ fontSize: fs(16), lineHeight: fs(26), color: c.text, marginTop: 8 }}>今早的热茶刚刚好，想把这一刻留下来。</Text></Card>
      <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><MoodIcon mood="calm" size={24} /><Text style={t.caption}>11月20日 · 平静 · 3张照片</Text></View><Text style={[t.readingTitle, { fontSize: fs(18), lineHeight: fs(28), marginTop: 8 }]}>走进山林的下午</Text><Text textRole="reading" style={{ fontSize: fs(15), lineHeight: fs(25), color: c.textSub, marginTop: 6 }}>沿着小路慢慢走，阳光穿过树叶，落在肩上。</Text><View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>{['photo-mountain', 'photo-sky', 'photo-lake'].map(key => <Image key={key} source={PHOTO_ASSETS[key]} accessibilityLabel="预览示例照片" style={{ flex: 1, height: 64, borderRadius: r(10) }} />)}</View></Card>
    </View>}
    {page === 'reading' && <Card style={{ paddingHorizontal: Math.round(28 - contentWidth * 16) }}>
      <Text style={t.caption}>2026年11月21日 · 星期六</Text>
      <Text style={[t.readingTitle, { marginTop: 12, marginBottom: 12 }]}>把平凡的一天，慢慢记住</Text>
      <Text style={t.bodySerif}>今天去了城郊的山林。沿着小路慢慢走，太阳透过树叶洒下斑驳的光影。走累了，就停下来喝一杯热茶。</Text>
      <Text style={[t.bodySerif, { marginTop: 14 }]}>「記得當時的心情」，也记得回家的路。下午 3:30，写下“Take it slow.”——不必每一天都特别，值得记住的事情就在身边。</Text>
    </Card>}
    {page === 'controls' && <Card>
      <Text style={t.h3}>界面文字</Text><Text style={[t.sub, { marginTop: 5 }]}>导航、表单、按钮与数字使用系统字体。</Text>
      <View style={{ marginTop: 16, minHeight: 50, borderWidth: 1, borderColor: c.controlBorder, borderRadius: r(14), backgroundColor: c.inputBg, justifyContent: 'center', paddingHorizontal: 14 }}><Text style={t.body}>记录标题 · Day 21</Text></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>{[{ label: '保存日记', bg: c.primary, fg: c.textOnPrimary }, { label: '稍后再写', bg: c.primaryFaint, fg: c.primaryDark }].map(item => <View key={item.label} style={{ minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: item.bg, borderRadius: r(999), paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: item.fg, fontSize: fs(15), fontWeight: '600' }}>{item.label}</Text></View>)}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 }}><Check size={18} color={c.success} /><Text style={{ color: c.success, fontSize: fs(13) }}>已保存在本机</Text></View>
      <View style={{ borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 16, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}><LockKeyhole size={19} color={c.text} /><Text style={[t.body, { flex: 1 }]}>隐私设置</Text><ChevronRight size={18} color={c.textMuted} /></View>
    </Card>}
  </View>;
}
