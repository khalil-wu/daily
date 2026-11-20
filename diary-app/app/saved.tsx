import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { useEntry, useStore } from '../src/store/store';
import { Button, Screen } from '../src/components/ui';
import { IMAGES } from '../src/data/assets';
import { FadeIn } from '../src/components/motion';
import { computeTodaySummary } from '../src/utils/grouping';
import { shouldAutoReply, startReply, useReplyJob } from '../src/services/ai';

/** 11. 保存成功页（1:1 复刻设计稿2 #11） */
export default function SavedScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c, t, fs, dark } = useTheme();
  const synced = useStore(s => !!(s.account && s.sync.cloud));
  const entries = useStore(s => s.entries);
  const entry = useEntry(id);
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
            <Image
              source={IMAGES.savedSuccess}
              style={{ width: 136, height: 136, borderRadius: 68, marginBottom: 20 }}
              resizeMode="cover"
            />
          </FadeIn>
          <FadeIn delay={120} style={{ alignItems: 'center' }}>
            <Text style={[t.h1, { fontSize: fs(23), textAlign: 'center' }]}>
              {synced ? '已保存并同步' : '已保存到本地'}
            </Text>
            <Text style={[t.sub, { textAlign: 'center', marginTop: 10 }]}>
              你的日记已安全保存，可在「全部日记」中查看
            </Text>
            <View style={{ marginTop: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: c.primaryFaint }}>
              <Text style={{ fontSize: fs(12.5), color: c.primaryDark, fontWeight: '500' }}>{cheer}</Text>
            </View>
          </FadeIn>

          {/* 「记得」的回信：自动回信开启时，写完就在这里回一封 */}
          {(reply || replyJob.status !== 'idle') && (
            <FadeIn delay={200} style={{ width: '100%', marginTop: 18 }}>
              <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.primarySoft }}>
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
