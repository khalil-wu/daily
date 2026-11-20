import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeftToLine, BookOpen, CalendarClock, ChevronDown, ChevronUp, CornerDownLeft, Hand, PenLine, RefreshCw, Smile,
  ArrowUpToLine, type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { openTutorial } from '../../src/store/store';
import { Button, Card, Group, IconTile, NavBar, Row, Screen } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { startHomeTour } from '../../src/components/TutorialOverlay';

const TIPS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: ArrowLeftToLine, title: '左滑日记卡片', desc: '在首页列表向左滑动卡片，可以置顶、收藏或删除。' },
  { icon: Hand, title: '长按日记卡片', desc: '长按任意一篇日记，可以移动到别的日记本。' },
  { icon: Smile, title: '点心情直接开写', desc: '首页「今日」卡片里点一个心情，带着它开始记录。' },
  { icon: CalendarClock, title: '补记过去的某一天', desc: '写作页点时间胶囊，可以选任意日期和时刻；日历里也能「补记这一天」。' },
  { icon: CornerDownLeft, title: '回车接续列表', desc: '在列表、待办或引用行里回车，会自动接上下一项；空项上再回车就结束。' },
  { icon: ArrowUpToLine, title: '快速回到顶部', desc: '在首页再点一次底部的「日记」，列表会滚回最上面。' },
  { icon: RefreshCw, title: '下拉同步', desc: '登录账号后，在首页下拉列表可以立即在本机账号间同步。' },
];

const FAQS = [
  { q: '不登录账号也能正常写日记吗？', a: '可以。记得日记采用本地优先设计，所有日记、照片、语音与标签都默认存储在当前设备中，无需联网即可完整使用。' },
  { q: '写到一半退出，内容会丢吗？', a: '不会。写作时每隔几秒会自动存为草稿；点「取消」时还会再问你一次要不要保存。选择「不保存」会撤掉这次编辑的全部改动。' },
  { q: '怎么修改一篇日记的日期？', a: '打开日记点「编辑」，再点顶部的时间胶囊，就能改成任意一天、任意时刻（不能晚于此刻）。' },
  { q: '误删了日记怎么找回？', a: '删除的日记会进入「我的 - 最近删除」保留 30 天，在此期间你可以随时一键恢复。' },
  { q: '如何把日记备份或迁移到新手机？', a: '可以在「设置 - 备份与恢复」中生成 JSON 完整备份文件，或在「导入与导出」中导出为 Markdown、PDF 或纯文本。' },
  { q: '应用锁忘记密码怎么办？', a: '如果开启了生物识别（Face ID / 指纹），可以通过生物识别解锁后在「隐私与安全」中修改密码。' },
];

/** 帮助与教程：新手导览重看入口 + 手势技巧 + 常见问题 + 反馈 */
export default function HelpScreen() {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [feedbackText, setFeedbackText] = useState('');

  const sendFeedback = () => {
    if (!feedbackText.trim()) {
      toast('请先填写你想反馈的内容', { type: 'warning' });
      return;
    }
    setFeedbackText('');
    toast('感谢你的反馈', { message: '我们已收到你的建议，会持续打磨体验' });
  };

  const startEditorTour = () => {
    router.push('/write');
    setTimeout(() => openTutorial('editor'), 750);
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <NavBar variant="large" title="帮助与教程" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <Group title="新手导览" footer="导览会用光圈指出真实的按钮位置，随时可以跳过。">
          <Row
            icon={BookOpen}
            iconColor={c.primaryDark}
            title="首页导览"
            subtitle="约 1 分钟 · 记录、整理与回看的入口"
            onPress={startHomeTour}
          />
          <Row
            icon={PenLine}
            iconColor={c.primaryDark}
            title="写作页导览"
            subtitle="时间、心情、排版与多媒体"
            onPress={startEditorTour}
          />
        </Group>

        <Text style={{ fontSize: fs(13), color: c.textSub, marginTop: 8, marginBottom: 10, marginLeft: 4, fontWeight: '500' }}>手势与技巧</Text>
        <Card padded={false} style={{ overflow: 'hidden', marginBottom: 22 }}>
          {TIPS.map((tip, idx) => (
            <View
              key={tip.title}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider }}
            >
              <IconTile icon={tip.icon} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: fs(14.5), color: c.text, fontWeight: '500' }}>{tip.title}</Text>
                <Text style={{ fontSize: fs(12.5), color: c.textSub, marginTop: 3, lineHeight: fs(12.5) * 1.55 }}>{tip.desc}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Text style={{ fontSize: fs(13), color: c.textSub, marginBottom: 10, marginLeft: 4, fontWeight: '500' }}>常见问题</Text>
        <Card padded={false} style={{ overflow: 'hidden', marginBottom: 22 }}>
          {FAQS.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <Pressable
                key={item.q}
                onPress={() => setOpenIdx(open ? null : idx)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={({ pressed }) => ({ padding: 16, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider, backgroundColor: pressed ? c.cardAlt : 'transparent' })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[t.h3, { fontSize: fs(14.5), flex: 1, marginRight: 10 }]}>{item.q}</Text>
                  {open ? <ChevronUp size={16} color={c.textMuted} /> : <ChevronDown size={16} color={c.textMuted} />}
                </View>
                {open && <Text style={[t.sub, { marginTop: 10, lineHeight: fs(13) * 1.65 }]}>{item.a}</Text>}
              </Pressable>
            );
          })}
        </Card>

        <Text style={{ fontSize: fs(13), color: c.textSub, marginBottom: 10, marginLeft: 4, fontWeight: '500' }}>意见与建议</Text>
        <Card style={{ marginBottom: 14 }}>
          <TextInput
            value={feedbackText}
            onChangeText={setFeedbackText}
            multiline
            placeholder="遇到问题或者有好点子，欢迎告诉我们…"
            placeholderTextColor={c.textMuted}
            style={{ fontSize: fs(14), color: c.text, minHeight: 96, textAlignVertical: 'top', outlineStyle: 'none' } as any}
          />
        </Card>
        <Button title="提交反馈" onPress={sendFeedback} />
      </ScrollView>
    </Screen>
  );
}
