import { HiddenAccessBoundary } from '../src/components/HiddenAccessBoundary';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { Text } from '../src/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, useEntry, useEntrySaveStatus, useStore } from '../src/store/store';
import { flushPendingState, saveState } from '../src/store/storage';
import { useFeedback } from '../src/components/feedback';
import { Button, Screen } from '../src/components/ui';
import { IMAGES } from '../src/data/assets';
import { FadeIn } from '../src/components/motion';
import { computeTodaySummary } from '../src/utils/grouping';
import { shouldAutoReply, startReply, useReplyJob } from '../src/services/ai';

/** 11. 保存成功页（1:1 复刻设计稿2 #11） */
export default function SavedScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <HiddenAccessBoundary entryId={id}><SavedContent /></HiddenAccessBoundary>;
}

function SavedContent() {
  const { id, revision } = useLocalSearchParams<{ id?: string; revision?: string }>();
  const { c, t, fs, dark, r, frame } = useTheme();
  const status = useEntrySaveStatus(id, Number(revision) || undefined);
  const { toast } = useFeedback();
  const synced = status.synced;
  const entries = useStore(s => s.entries);
  const entry = useEntry(id);
  const title = !entry ? '暂未找到这篇日记' : status.error ? '还未保存到设备' : !status.local ? '正在保存到设备' : synced ? '已保存并同步' : '已保存到本地';
  const detail = status.error || (!entry ? '返回首页查看日记列表。' : !status.local ? '请稍候，正在写入设备存储。' : status.conflict ? '云端有另一份修改，请确认要保留的版本。' : synced ? '当前版本及附件已获云端确认。' : status.progress.status === 'syncing' ? '正在同步，完成前以本机版本为准。' : status.enabled ? status.progress.message || '当前版本尚未获得云端确认，可稍后重试同步。' : '当前版本已写入设备，可在日记列表中查看。');
  const retry = async () => {
    if (!status.local) { await saveState(actions.snapshot(), true); await flushPendingState(); }
    else if (status.conflict) { router.push('/sync-conflict'); return; }
    else {
      const result = await actions.syncNow();
      if (!result.ok) toast(result.message || '同步未完成', { type: 'warning' });
      else if (result.conflicts) router.push('/sync-conflict');
      else if (result.partial) toast('部分内容已同步，其他类别的同步已关闭', { type: 'info' });
    }
  };
  const replyJob = useReplyJob(id);
  const today = useMemo(() => computeTodaySummary(entries), [entries]);
  // 保存之后给一句具体的鼓励：连续天数或今日篇数
  const cheer =
    today.streak >= 2
      ? `已连续记录 ${today.streak} 天，继续保持`
      : today.count > 1
        ? `今天已经记录了 ${today.count} 篇`
        : '又留住了一个值得记住的瞬间';

  // 开启了「记得」自动回信：发布后在后台写一封，写好了直接出现在这里
  const reply = entry?.ai?.reply;
  useEffect(() => {
    if (!entry || reply) return;
    void shouldAutoReply(entry).then(ok => {
      if (ok) void startReply(entry.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <FadeIn dy={0} scaleFrom={0.86} duration={420}>
            <View
              style={{
                width: 152,
                height: 152,
                borderRadius: dark ? 76 : 0,
                backgroundColor: dark ? 'rgba(236,246,247,0.92)' : 'transparent',
                padding: dark ? 14 : 0,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Image
                source={IMAGES.savedSuccess}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>
          </FadeIn>
          <FadeIn delay={120} style={{ alignItems: 'center' }}>
            <Text style={[t.h1, { fontSize: fs(23), textAlign: 'center' }]}>
              {title}
            </Text>
            <Text style={[t.sub, { textAlign: 'center', marginTop: 10 }]}>
              {detail}
            </Text>
            <View style={{ marginTop: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: r(999), backgroundColor: c.primaryFaint }}>
              <Text style={{ fontSize: fs(12.5), color: c.primaryDark, fontWeight: '500' }}>{cheer}</Text>
            </View>
          </FadeIn>

          {/* 「记得」的回信：自动回信开启时，写完就在这里回一封 */}
          {(reply || replyJob.status !== 'idle') && (
            <FadeIn delay={200} style={{ width: '100%', marginTop: 18 }}>
              <View style={{ backgroundColor: c.card, borderRadius: r(16), padding: 16, ...frame, borderColor: c.primarySoft }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Sparkles size={13} color={c.primaryDark} />
                  <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '600' }}>记得的回信</Text>
                </View>
                {reply ? (
                  <Text style={{ fontSize: fs(13.5), color: c.text, lineHeight: fs(13.5) * 1.65, marginTop: 10 }}>{reply.text}</Text>
                ) : replyJob.status === 'loading' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <ActivityIndicator size={13} color={c.textSub} />
                    <Text style={{ fontSize: fs(13), color: c.textSub }}>记得正在读你刚写的这篇…</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: fs(12.5), color: c.textSub, marginTop: 10 }}>
                    {replyJob.error ?? '这次没有写成回信，详情页里可以再试'}
                  </Text>
                )}
              </View>
            </FadeIn>
          )}

          <FadeIn delay={240} style={{ width: '100%', gap: 12, marginTop: 28 }}>
            {!!entry && (!status.local || (status.enabled && !synced)) && <Button title={!status.local ? '重试保存' : status.conflict ? '处理版本冲突' : '立即同步'} variant="secondary" loading={status.progress.status === 'syncing'} onPress={() => void retry().catch(e => toast(e.message || '重试失败', { type: 'error' }))} />}
            <Button
              title="查看日记"
              onPress={() => {
                if (id) router.replace({ pathname: '/memory/[id]', params: { id } });
                else router.replace('/(tabs)');
              }}
            />
            <Button
              title="继续写作"
              variant="secondary"
              onPress={() => router.replace('/write')}
            />
          </FadeIn>

          <Pressable onPress={() => router.replace('/(tabs)')} style={{ marginTop: 18 }}>
            <Text style={{ fontSize: fs(13), color: c.textSub }}>回到首页</Text>
          </Pressable>
        </View>

        <View style={{ height: 140, width: '100%', overflow: 'hidden' }}>
          <Image source={IMAGES.mountainsMist} style={{ width: '100%', height: '100%', opacity: dark ? 0.3 : 0.85 }} resizeMode="cover" />
          <LinearGradient colors={[c.bg, 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70 }} />
        </View>
      </View>
    </Screen>
  );
}
