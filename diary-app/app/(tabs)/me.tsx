import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  Bell, BookMarked, BookOpen, ChevronRight, Cloud, Download, FileText, HardDrive, Heart,
  HelpCircle, Image as ImageIcon, Info, MapPin, Palette, Settings, Shield, Sparkles, Target, Trash2, Users,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Card, Field, Group, IconTile, Row, Screen } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { BottomSheet, FadeIn, PressableScale } from '../../src/components/motion';
import { startHomeTour } from '../../src/components/TutorialOverlay';
import { IMAGES, photoSource } from '../../src/data/assets';
import { storePhoto } from '../../src/services/photoStore';
import { usePhotoUri } from '../../src/utils/usePhotoUri';
import { uid } from '../../src/utils/text';
import { computeStats } from '../../src/utils/stats';
import { daysBetween } from '../../src/utils/date';
import { fmtNumber } from '../../src/utils/text';

/** 16 & 设计稿3 #1. 个人中心页 */
export default function MeScreen() {
  const { c, t, fs, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { toast } = useFeedback();
  const entries = useStore(s => s.entries);
  const people = useStore(s => s.people);
  const notebooks = useStore(s => s.notebooks);
  const goals = useStore(s => s.goals);
  const profile = useStore(s => s.profile);
  const account = useStore(s => s.account);
  const firstUseAt = useStore(s => s.firstUseAt);
  const avatarUri = usePhotoUri(profile.avatar);

  const [editOpen, setEditOpen] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [sigInput, setSigInput] = useState(profile.signature);

  const stats = useMemo(() => computeStats(entries), [entries]);
  const draftCount = useMemo(() => entries.filter(e => !e.deletedAt && e.status === 'draft').length, [entries]);
  const favCount = useMemo(() => entries.filter(e => !e.deletedAt && e.favorite).length, [entries]);
  const trashCount = useMemo(() => entries.filter(e => !!e.deletedAt).length, [entries]);
  // 从「开始使用」和「最早一篇日记」里取更早的那天算起：恢复或导入的旧日记也算陪伴的日子
  const companionDays = useMemo(() => {
    let start = firstUseAt;
    for (const e of entries) if (!e.deletedAt && e.createdAt < start) start = e.createdAt;
    return Math.max(1, daysBetween(start, Date.now()) + 1);
  }, [entries, firstUseAt]);

  const openProfileEdit = () => {
    setNameInput(profile.name);
    setSigInput(profile.signature);
    setEditOpen(true);
  };

  const pickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      const asset = res.canceled ? undefined : res.assets[0];
      if (asset?.uri) {
        const stored = await storePhoto(uid('avatar'), asset.uri, { blob: asset.file });
        actions.setProfile({ avatar: stored.uri });
        toast(stored.durable ? '头像已更新' : '头像已更新，但没能存进应用，重新打开后可能失效', { type: stored.durable ? undefined : 'warning' });
      }
    } catch {
      toast('无法打开相册', { type: 'warning' });
    }
  };

  const saveProfile = () => {
    actions.setProfile({ name: nameInput.trim() || '记得自己', signature: sigInput.trim() || '记下生活，记得自己' });
    setEditOpen(false);
    toast('个人资料已保存');
  };

  return (
    <Screen edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
        {/* 顶部暮色芦苇封面 + 渐变融合 */}
        <View style={{ height: 184, width: '100%', overflow: 'hidden' }}>
          <Image source={IMAGES.meCover} style={{ width: '100%', height: '100%', opacity: dark ? 0.55 : 0.92 }} resizeMode="cover" />
          <LinearGradient colors={['transparent', c.bg]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 }} />
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            style={{ position: 'absolute', top: insets.top + 8, right: 18, width: 36, height: 36, borderRadius: 18, backgroundColor: dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Settings size={19} color={c.text} strokeWidth={1.7} />
          </Pressable>
        </View>

        <FadeIn dy={14} duration={380} style={{ paddingHorizontal: 20, marginTop: -46 }}>
          {/* 头像与用户信息 */}
          <Pressable onPress={openProfileEdit} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <Image
              source={photoSource(avatarUri) ?? IMAGES.avatar}
              style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: c.card, backgroundColor: c.primarySoft }}
            />
            <View style={{ flex: 1, minWidth: 0, marginLeft: 14 }}>
              <Text style={[t.h1, { fontSize: fs(20) }]} numberOfLines={1}>{profile.name}</Text>
              <Text style={{ fontSize: fs(12.5), color: c.textSub, marginTop: 4 }} numberOfLines={1}>
                {profile.signature} · 第 {companionDays} 天
              </Text>
              <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 2 }}>
                共 {stats.totalEntries} 篇日记 · {fmtNumber(stats.totalWords)} 字
              </Text>
            </View>
            <ChevronRight size={18} color={c.textMuted} />
          </Pressable>

          {/* 3 栏核心数字 */}
          <Card style={{ flexDirection: 'row', paddingVertical: 16, marginBottom: 14 }}>
            {[
              { val: String(stats.recordDays), label: '记录天数' },
              { val: String(stats.totalEntries), label: '日记篇数' },
              { val: String(stats.currentStreak), label: '连续记录' },
            ].map((item, idx) => (
              <View key={item.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: idx ? StyleSheet.hairlineWidth : 0, borderLeftColor: c.divider }}>
                <Text style={{ fontSize: fs(21), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{item.val}</Text>
                <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 4 }}>{item.label}</Text>
              </View>
            ))}
          </Card>

          {/* 我的空间：内容入口用图标宫格，替代原来 8 行长列表（IconTile 来自 ui.tsx） */}
          <Text style={{ fontSize: fs(13), color: c.textSub, marginBottom: 8, marginLeft: 4, fontWeight: '500' }}>我的空间</Text>
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingVertical: 10, marginBottom: 14 }}>
            {[
              { icon: BookMarked, label: '日记本', badge: `${notebooks.length}`, path: '/notebooks' as const },
              { icon: Users, label: '身边人', badge: people.length ? `${people.length}` : undefined, path: '/people' as const },
              { icon: Sparkles, label: '年度回顾', path: '/annual-report' as const },
              { icon: FileText, label: '草稿箱', badge: draftCount ? `${draftCount}` : undefined, path: '/drafts' as const },
              { icon: Heart, label: '收藏置顶', badge: favCount ? `${favCount}` : undefined, path: '/favorites' as const },
              { icon: ImageIcon, label: '影像记忆', badge: stats.totalPhotos ? `${stats.totalPhotos}` : undefined, path: '/photos' as const },
              { icon: MapPin, label: '足迹地图', badge: stats.placeCounts.length ? `${stats.placeCounts.length}` : undefined, path: '/memory-map' as const },
              { icon: Target, label: '写作目标', badge: goals.enabled ? `${goals.dailyWords}字` : undefined, path: '/settings/goals' as const },
              { icon: Trash2, label: '最近删除', badge: trashCount ? `${trashCount}` : undefined, path: '/trash' as const },
            ].map(item => (
              <PressableScale
                key={item.label}
                scaleTo={0.92}
                onPress={() => router.push(item.path)}
                accessibilityLabel={item.label}
                style={{ width: '25%', alignItems: 'center', paddingVertical: 10 }}
              >
                <IconTile icon={item.icon} size={42} />
                <Text style={{ fontSize: fs(12), color: c.text, marginTop: 7 }} numberOfLines={1}>{item.label}</Text>
                <Text style={{ fontSize: fs(10.5), color: c.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                  {item.badge ?? ' '}
                </Text>
              </PressableScale>
            ))}
          </Card>

          {/* 账号、偏好与设置 */}
          <Group>
            <Row
              icon={Cloud}
              iconColor={c.primaryDark}
              title="账号与同步"
              value={account ? '已登录' : '本地使用'}
              onPress={() => router.push('/settings/account')}
            />
            <Row icon={HardDrive} iconColor={c.primaryDark} title="备份与恢复" onPress={() => router.push('/settings/backup')} />
            <Row icon={Download} iconColor={c.primaryDark} title="导入与导出" onPress={() => router.push('/settings/transfer')} />
            <Row icon={Palette} iconColor={c.primaryDark} title="外观与写作排版" onPress={() => router.push('/settings/appearance')} />
            <Row icon={Bell} iconColor={c.primaryDark} title="提醒与通知" onPress={() => router.push('/settings/reminders')} />
            <Row icon={Shield} iconColor={c.primaryDark} title="隐私与安全" onPress={() => router.push('/settings/privacy')} />
          </Group>

          <Group>
            <Row
              icon={BookOpen}
              iconColor={c.primaryDark}
              title="新手导览"
              subtitle="跟着光圈重新认识首页的每个入口"
              onPress={startHomeTour}
            />
            <Row icon={HelpCircle} iconColor={c.primaryDark} title="帮助与教程" value="技巧 · 常见问题" onPress={() => router.push('/settings/help')} />
            <Row icon={Info} iconColor={c.primaryDark} title="关于记得日记" value="v1.0.0" onPress={() => router.push('/settings/about')} />
          </Group>
        </FadeIn>
      </ScrollView>

      {/* 编辑个人资料面板 */}
      <BottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="编辑个人资料" keyboard>
        <PressableScale onPress={() => void pickAvatar()} style={{ alignSelf: 'center', alignItems: 'center', marginTop: 6, marginBottom: 18 }}>
          <Image source={photoSource(avatarUri) ?? IMAGES.avatar} style={{ width: 76, height: 76, borderRadius: 38 }} />
          <Text style={{ fontSize: fs(12), color: c.primaryDark, marginTop: 6 }}>更换头像</Text>
        </PressableScale>
        <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 6 }}>昵称</Text>
        <Field value={nameInput} onChangeText={setNameInput} placeholder="你的称呼" maxLength={16} />
        <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 6 }}>签名</Text>
        <Field value={sigInput} onChangeText={setSigInput} placeholder="一句留给自己的话" maxLength={30} />
        <Button title="保存修改" onPress={saveProfile} style={{ marginTop: 8 }} />
      </BottomSheet>
    </Screen>
  );
}
