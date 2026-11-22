import { HiddenAccessBoundary } from '../src/components/HiddenAccessBoundary';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';
import { Text } from '../src/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, useEntry, useEntrySaveStatus, useStore } from '../src/store/store';
import { flushPendingState, saveState } from '../src/store/storage';
import { useFeedback } from '../src/components/feedback';
import { Button, Illustration, Screen, haptic } from '../src/components/ui';
import { FadeIn, ND, useReducedMotion } from '../src/components/motion';
import { fmtPostmarkDate, PostcardNote } from '../src/components/stationery';
import { computeTodaySummary } from '../src/utils/grouping';
import { shouldAutoReply, startReply, useReplyJob } from '../src/services/ai';

/** 保存成功时落下的「记得」印章：砸下来 + 墨圈晕开 */
function SealStamp() {
  const { t, fs } = useTheme();
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      a.setValue(1);
      return;
    }
    const stamp = Animated.sequence([
      Animated.delay(380),
      Animated.spring(a, { toValue: 1, useNativeDriver: ND, damping: 14, stiffness: 380, mass: 0.5 }),
    ]);
    stamp.start(({ finished }) => finished && haptic('medium'));
    const ripple = Animated.sequence([
      Animated.delay(560),
      Animated.timing(ring, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
    ]);
    ripple.start();
    return () => {
      stamp.stop();
      ripple.stop();
    };
  }, [a, ring, reduced]);
  const now = new Date();
  const date = `${now.getMonth() + 1}.${now.getDate()}`;
  return (
    <View style={{ position: 'absolute', right: -14, bottom: 20, width: 64, height: 64 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* 墨圈 */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: '#C8554A',
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }, { rotate: '-8deg' }],
        }}
      />
      {/* 印面 */}
      <Animated.View
        style={{
          flex: 1,
          borderRadius: 10,
          backgroundColor: '#C8554A',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: a,
          transform: [
            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1] }) },
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
            { rotate: '-8deg' },
          ],
        }}
      >
        <View style={{ position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' }} />
        <Text style={[t.h2, { fontSize: fs(13), color: '#FFFFFF', lineHeight: fs(16) }]}>记得</Text>
        <Text style={[t.h2, { fontSize: fs(10), color: 'rgba(255,255,255,0.9)', lineHeight: fs(13) }]}>{date}</Text>
      </Animated.View>
    </View>
  );
}

/** 11. 保存成功页（1:1 复刻设计稿2 #11） */
export default function SavedScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <HiddenAccessBoundary entryId={id}><SavedContent /></HiddenAccessBoundary>;
}

function SavedContent() {
  const { id, revision } = useLocalSearchParams<{ id?: string; revision?: string }>();
  const { c, t, fs, r } = useTheme();
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

  // 保存成功就是结束：印章落下后自动翻到刚写好的这一页，不用再点一次。
  // 需要用户处理的情况（未落盘、冲突、等待回信）才停在这里。
  const settled = !!entry && status.local && !status.error && !status.conflict && !reply && replyJob.status === 'idle';
  const [stay, setStay] = useState(false);
  useEffect(() => {
    if (!settled || stay || !id) return;
    const timer = setTimeout(() => router.replace({ pathname: '/memory/[id]', params: { id } }), 1500);
    return () => clearTimeout(timer);
  }, [settled, stay, id]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'space-between' }} onTouchStart={() => setStay(true)} {...(Platform.OS === 'web' ? ({ onMouseDown: () => setStay(true) } as object) : {})}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <FadeIn dy={0} scaleFrom={0.86} duration={420}>
            <View>
              <Illustration name="savedSuccess" size={152} style={{ marginBottom: 16 }} />
              <SealStamp />
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

          {/* 「记得」的回信：自动回信开启时，写完就在这里寄来一封明信片 */}
          {(reply || replyJob.status !== 'idle') && (
            <FadeIn delay={200} style={{ width: '100%', marginTop: 18 }}>
              <PostcardNote
                salutation="见字如面 · 记得来信"
                postmark={fmtPostmarkDate(reply?.at ?? entry?.createdAt ?? Date.now())}
                body={reply?.text}
                loadingText={replyJob.status === 'loading' ? '记得正在读你刚写的这篇…' : undefined}
                errorText={replyJob.status !== 'loading' && !reply ? (replyJob.error ?? '这次没有写成回信，详情页里可以再试') : undefined}
              />
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
            <Text style={{ fontSize: fs(13), color: c.textSub }}>回到日记本</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
