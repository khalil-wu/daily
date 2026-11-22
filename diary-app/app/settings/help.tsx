import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/components/text';
import { router } from 'expo-router';
import {
  ArrowLeftToLine, BookOpen, CalendarClock, ChevronDown, ChevronUp, CornerDownLeft, Hand, PenLine, RefreshCw, Smile,
  ArrowUpToLine, type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button, Card, Group, IconTile, NavBar, Row, Screen } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { startHomeTour } from '../../src/components/TutorialOverlay';
import { loadFeedbackDraft, newFeedbackDraft, saveFeedbackDraft, submitFeedback, type FeedbackDraft } from '../../src/services/feedback';
import { exportTextFile } from '../../src/utils/transfer';

const TIPS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: ArrowLeftToLine, title: '左滑日记卡片', desc: '在首页列表向左滑动卡片，可以置顶、收藏或删除。' },
  { icon: Hand, title: '长按日记卡片', desc: '长按任意一篇日记，可以移动到别的日记本。' },
  { icon: Smile, title: '点心情直接开写', desc: '首页「今日」卡片里点一个心情，带着它开始记录。' },
  { icon: CalendarClock, title: '补记过去的某一天', desc: '写作页点时间胶囊，可以选任意日期和时刻；日历里也能「补记这一天」。' },
  { icon: CornerDownLeft, title: '回车接续列表', desc: '在列表、待办或引用行里回车，会自动接上下一项；空项上再回车就结束。' },
  { icon: ArrowUpToLine, title: '快速回到顶部', desc: '在首页再点一次底部的「日记」，列表会滚回最上面。' },
  { icon: RefreshCw, title: '下拉同步', desc: '登录账号后，可在首页下拉发起同步；同步结果请查看账号页。' },
];

const FAQS = [
  { q: '不登录账号也能正常写日记吗？', a: '可以。记得日记采用本地优先设计，所有日记、照片、语音与标签都默认存储在当前设备中，无需联网即可完整使用。' },
  { q: '写到一半退出，内容会丢吗？', a: '写作时会自动保存本次内容，离开前也会尝试保存。如果本机存储失败，会保留编辑内容并提示重试；选择「不保存」会撤掉本次修改。请留意写作页的保存状态。' },
  { q: '怎么修改一篇日记的日期？', a: '打开日记点「编辑」，再点顶部的时间胶囊，就能改成任意一天、任意时刻（不能晚于此刻）。' },
  { q: '误删了日记怎么找回？', a: '删除的日记会进入「我的 - 最近删除」保留 30 天，在此期间你可以随时一键恢复。' },
  { q: '如何把日记备份或迁移到新手机？', a: '换设备请在「备份与恢复」生成包含原始附件的备份并在新设备恢复；「导入与导出」的 Markdown、PDF、纯文本用于阅读与分享，不能替代完整备份。请保留一份设备之外的备份。' },
  { q: '应用锁忘记密码怎么办？', a: '如果开启了生物识别（Face ID / 指纹），可以通过生物识别解锁后在「隐私与安全」中修改密码。' },
];

/** 帮助与教程：新手导览重看入口 + 手势技巧 + 常见问题 + 反馈 */
export default function HelpScreen() {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void loadFeedbackDraft().then(value => { if (mounted.current) setDraft(value); }).catch(() => {
      if (mounted.current) { setDraft(newFeedbackDraft()); setError('本机未能读取反馈草稿，请导出保留副本'); }
    });
    return () => { mounted.current = false; };
  }, []);
  const changeFeedback = (text: string) => {
    const next = newFeedbackDraft(text);
    setDraft(next); setError(''); setReceipt('');
    void saveFeedbackDraft(next).catch(() => { if (mounted.current) setError('本机未能保存反馈草稿，请导出保留副本'); });
  };
  const sendFeedback = async () => {
    if (!draft || sending) return;
    if (!draft.text.trim()) { setError('请先填写反馈内容'); return; }
    setSending(true); setError(''); setReceipt('');
    try {
      const id = await submitFeedback(draft);
      const next = newFeedbackDraft();
      await saveFeedbackDraft(next);
      if (mounted.current) { setDraft(next); setReceipt(`反馈已提交，编号 ${id.slice(0, 8)}`); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '提交失败，内容已保留');
    } finally { if (mounted.current) setSending(false); }
  };
  const exportFeedback = async () => {
    if (!draft?.text.trim()) { setError('请先填写反馈内容'); return; }
    const result = await exportTextFile('记得日记-反馈.txt', draft.text);
    if (result.ok) toast('已导出反馈副本');
    else setError(result.message || '导出失败，请重试');
  };

  const startEditorTour = () => {
    router.push({ pathname: '/write', params: { tour: '1' } });
  };

  return (
    <Screen enter="page" edges={['top', 'bottom']} keyboard>
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
            value={draft?.text ?? ''}
            onChangeText={changeFeedback}
            editable={!!draft && !sending}
            accessibilityLabel="反馈内容"
            maxLength={4000}
            multiline
            placeholder="遇到问题或者有好点子，欢迎告诉我们…"
            placeholderTextColor={c.textMuted}
            style={{ fontSize: fs(14), color: c.text, minHeight: 96, textAlignVertical: 'top', outlineStyle: 'none' } as any}
          />
        </Card>
        <Text style={[t.caption, { marginBottom: 12 }]}>仅发送你在此填写的内容，不会附带日记。未发送内容会保留在本机。</Text>
        {!!error && <Text accessibilityRole="alert" style={[t.sub, { color: c.danger, marginBottom: 12 }]}>{error}</Text>}
        {!!receipt && <Text accessibilityLiveRegion="polite" style={[t.sub, { color: c.primaryDark, marginBottom: 12 }]}>{receipt}</Text>}
        <Button title={sending ? '提交中…' : '提交反馈'} loading={sending} disabled={!draft || sending} onPress={() => void sendFeedback()} />
        <Button title="导出反馈副本" variant="ghost" disabled={sending} onPress={() => void exportFeedback()} style={{ marginTop: 8 }} />
      </ScrollView>
    </Screen>
  );
}
