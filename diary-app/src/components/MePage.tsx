import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './text';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Bell, BookMarked, BookOpen, ChevronLeft, ChevronRight, Cloud, Download, FileText, HardDrive, Heart,
  HelpCircle, Image as ImageIcon, Info, MapPin, Palette, Settings, Shield, Sparkles, Target, Trash2, Users,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { actions, useStore } from '../store/store';
import { Button, Card, Field, Group, IconButton, Row, Screen, goBack } from './ui';
import { useFeedback } from './feedback';
import { BottomSheet, PressableScale, useCountUp } from './motion';
import { startHomeTour } from './TutorialOverlay';
import { IMAGES, photoSource } from '../data/assets';
import { storePhoto } from '../services/photoStore';
import { usePhotoUri } from '../utils/usePhotoUri';
import { uid, fmtNumber } from '../utils/text';
import { computeStats } from '../utils/stats';
import { daysBetween } from '../utils/date';

/** 个人中心：书内「我的」标签与书架头像进入的页面共用这一份内容 */
export function MePage({ inTab = false }: { inTab?: boolean }) {
  const { c, t, fs } = useTheme();
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

  const stats = useMemo(() => computeStats(entries.filter(e => !e.hidden)), [entries]);
  const draftCount = useMemo(() => entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'draft').length, [entries]);
  const favCount = useMemo(() => entries.filter(e => !e.deletedAt && !e.hidden && e.favorite).length, [entries]);
  const trashCount = useMemo(() => entries.filter(e => !!e.deletedAt).length, [entries]);
  // 从「开始使用」和「最早一篇日记」里取更早的那天算起：恢复或导入的旧日记也算陪伴的日子
  const companionDays = useMemo(() => {
    let start = firstUseAt;
    for (const e of entries) if (!e.deletedAt && !e.hidden && e.createdAt < start) start = e.createdAt;
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

  const spaces = [
    { icon: BookMarked, label: '日记本', badge: `${notebooks.length}`, onPress: () => router.dismissTo('/shelf') },
    { icon: Users, label: '身边人', badge: people.length ? `${people.length}` : undefined, onPress: () => router.push('/people') },
    { icon: ImageIcon, label: '影像记忆', badge: stats.totalPhotos ? `${stats.totalPhotos}` : undefined, onPress: () => router.push('/photos') },
    { icon: MapPin, label: '足迹地图', badge: stats.placeCounts.length ? `${stats.placeCounts.length}` : undefined, onPress: () => router.push('/memory-map') },
    { icon: Heart, label: '收藏置顶', badge: favCount ? `${favCount}` : undefined, onPress: () => router.push('/favorites') },
    { icon: FileText, label: '草稿箱', badge: draftCount ? `${draftCount}` : undefined, onPress: () => router.push('/drafts') },
    { icon: Sparkles, label: '年度回顾', onPress: () => router.navigate({ pathname: '/review', params: { scope: 'year' } }) },
    { icon: Target, label: '写作目标', badge: goals.enabled ? `${goals.dailyWords}字` : undefined, onPress: () => router.push('/settings/goals') },
  ];

  return (
    <Screen enter={inTab ? undefined : 'page'} edges={['top']}>
      <View style={{ height: 52, paddingLeft: inTab ? 20 : 10, paddingRight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {inTab ? (
          <Text style={[t.h1, { fontSize: fs(26) }]}>我的</Text>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={goBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
          </Pressable>
        )}
        <IconButton icon={Settings} label="设置" onPress={() => router.push('/settings')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`编辑个人资料，${profile.name}`}
          onPress={openProfileEdit}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, opacity: pressed ? 0.75 : 1 })}
        >
          <Image source={photoSource(avatarUri) ?? IMAGES.avatar} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.primarySoft }} />
          <View style={{ flex: 1, minWidth: 0, marginLeft: 14 }}>
            <Text style={[t.h1, { fontSize: fs(21), lineHeight: fs(28) }]} numberOfLines={1}>{profile.name}</Text>
            <Text style={{ fontSize: fs(13), color: c.textSub, marginTop: 3 }} numberOfLines={1}>{profile.signature}</Text>
          </View>
          <ChevronRight size={18} color={c.textMuted} />
        </Pressable>

        <Card style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 4, marginTop: 6, marginBottom: 24 }}>
          {[
            { num: companionDays, label: '陪伴天数' },
            { num: stats.totalEntries, label: '日记' },
            { num: stats.totalWords, label: '字数' },
            { num: stats.currentStreak, label: '连续记录' },
          ].map((item, idx) => (
            <MeStat key={item.label} num={item.num} label={item.label} divider={idx > 0} />
          ))}
        </Card>

        <Text style={{ fontSize: fs(13), color: c.textSub, marginBottom: 8, marginLeft: 4, fontWeight: '600' }}>我的空间</Text>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingVertical: 8, marginBottom: 24 }}>
          {spaces.map(item => (
            <PressableScale
              key={item.label}
              scaleTo={0.92}
              onPress={item.onPress}
              accessibilityLabel={item.label}
              style={{ width: '25%', alignItems: 'center', paddingVertical: 10 }}
            >
              <item.icon size={22} color={c.text} strokeWidth={1.6} />
              <Text style={{ fontSize: fs(12), color: c.text, marginTop: 8 }} numberOfLines={1}>{item.label}</Text>
              <Text style={{ fontSize: fs(10.5), color: c.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                {item.badge ?? ' '}
              </Text>
            </PressableScale>
          ))}
        </Card>

        <Group title="数据与偏好" style={{ marginBottom: 24 }}>
          <Row icon={Cloud} title="账号与同步" value={account ? '已登录' : '本地使用'} onPress={() => router.push('/settings/account')} />
          <Row icon={HardDrive} title="备份与恢复" onPress={() => router.push('/settings/backup')} />
          <Row icon={Download} title="导入与导出" onPress={() => router.push('/settings/transfer')} />
          <Row icon={Palette} title="外观与写作排版" onPress={() => router.push('/settings/appearance')} />
          <Row icon={Bell} title="提醒与通知" onPress={() => router.push('/settings/reminders')} />
          <Row icon={Shield} title="隐私与安全" onPress={() => router.push('/settings/privacy')} />
          <Row icon={Trash2} title="最近删除" value={trashCount ? `${trashCount} 篇` : undefined} onPress={() => router.push('/trash')} />
        </Group>

        <Group title="帮助">
          <Row icon={BookOpen} title="新手导览" subtitle="跟着光圈重新认识首页的每个入口" onPress={startHomeTour} />
          <Row icon={HelpCircle} title="帮助与教程" value="技巧 · 常见问题" onPress={() => router.push('/settings/help')} />
          <Row icon={Info} title="关于记得日记" value="v1.0.0" onPress={() => router.push('/settings/about')} />
        </Group>
      </ScrollView>

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

/** 「我的」数字：挂载时滚动到位（减弱动态时直接显示） */
function MeStat({ num, label, divider }: { num: number; label: string; divider: boolean }) {
  const { c, fs } = useTheme();
  const v = useCountUp(num, 600);
  return (
    <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: divider ? StyleSheet.hairlineWidth : 0, borderLeftColor: c.divider }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: fs(19), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{fmtNumber(v)}</Text>
      <Text style={{ fontSize: fs(11.5), color: c.textSub, marginTop: 4 }}>{label}</Text>
    </View>
  );
}
