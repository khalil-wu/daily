import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Cloud, RefreshCw, Smartphone } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Card, Group, NavBar, Radio, Row, Screen, Switch } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { fmtDateTime } from '../../src/utils/date';

/** 3. 账号与同步（1:1 复刻设计稿3 #3） */
export default function AccountSyncScreen() {
  const { c, t, fs, dark } = useTheme();
  const { toast, confirm } = useFeedback();
  const account = useStore(s => s.account);
  const usageMode = useStore(s => s.usageMode);
  const sync = useStore(s => s.sync);
  const conflicts = useStore(s => s.conflicts);
  const [syncing, setSyncing] = useState(false);

  const isLocal = !account || usageMode === 'local';

  const runSync = async () => {
    if (!account) {
      toast('请先登录账号后再开启同步', { type: 'info' });
      router.push('/auth/login');
      return;
    }
    setSyncing(true);
    const res = await actions.syncNow();
    setSyncing(false);
    if (!res.ok) {
      toast(res.message || '同步失败', { type: 'error' });
      return;
    }
    if (res.conflicts > 0) {
      router.push('/sync-conflict');
    } else {
      toast('操作成功', { message: '日记已保存并同步' });
    }
  };

  const logout = async () => {
    const ok = await confirm({
      title: '退出当前账号？',
      message: '退出后将切换为本地使用模式，本地已保存的日记不会被删除。',
      confirmText: '退出登录',
    });
    if (!ok) return;
    actions.logout();
    toast('已退出登录');
  };

  const syncSummary = [
    '日记',
    sync.syncPhotos ? '照片' : null,
    sync.syncTags ? '标签' : null,
    sync.syncSettings ? '设置' : null,
  ]
    .filter(Boolean)
    .join('、');

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="账号与同步" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <View style={{ gap: 12, marginBottom: 18 }}>
          <Pressable
            onPress={() => {
              if (account) void logout();
              else actions.completeOnboarding('local');
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: isLocal ? 1.5 : StyleSheet.hairlineWidth,
              borderColor: isLocal ? c.primary : c.divider,
              shadowColor: c.shadow,
              shadowOpacity: dark ? 0 : 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: dark ? 0 : 1,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Smartphone size={20} color={c.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[t.h3, { fontSize: fs(15.5) }]}>本地使用（推荐）</Text>
              <Text style={[t.sub, { marginTop: 3 }]}>无需登录，数据仅保存在本机</Text>
            </View>
            <Radio checked={isLocal} />
          </Pressable>

          <Pressable
            onPress={() => {
              if (!account) router.push('/auth/login');
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: !isLocal ? 1.5 : StyleSheet.hairlineWidth,
              borderColor: !isLocal ? c.primary : c.divider,
              shadowColor: c.shadow,
              shadowOpacity: dark ? 0 : 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: dark ? 0 : 1,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Cloud size={20} color={c.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[t.h3, { fontSize: fs(15.5) }]}>{account ? '已登录' : '账号登录同步'}</Text>
              <Text style={[t.sub, { marginTop: 3 }]}>{account ? account.identifier : '点击登录或注册，多设备同步日记'}</Text>
            </View>
            <Radio checked={!!account} />
          </Pressable>
        </View>

        <Group title="同步与数据">
          <Row
            title="账号同步（本机）"
            subtitle="尚未接入云端；换设备请用备份文件迁移"
            right={
              <Switch
                value={sync.cloud}
                onChange={v => {
                  if (v && !account) {
                    toast('请先登录账号', { type: 'info' });
                    router.push('/auth/login');
                    return;
                  }
                  actions.setSync({ cloud: v });
                }}
              />
            }
          />
          <Row
            title="仅在 Wi-Fi 下同步"
            right={<Switch value={sync.wifiOnly} onChange={v => actions.setSync({ wifiOnly: v })} />}
          />
          <Row
            title="同步照片"
            right={<Switch value={sync.syncPhotos} onChange={v => actions.setSync({ syncPhotos: v })} />}
          />
          <Row
            title="同步标签与设置"
            right={
              <Switch
                value={sync.syncTags && sync.syncSettings}
                onChange={v => actions.setSync({ syncTags: v, syncSettings: v })}
              />
            }
          />
          <Row
            title="同步内容"
            subtitle={syncSummary}
          />
          <Row
            title="上次同步"
            subtitle={
              conflicts.length
                ? `检测到 ${conflicts.length} 处同步冲突，请及时处理`
                : sync.lastSyncAt
                  ? `${fmtDateTime(sync.lastSyncAt)} · 同步完成`
                  : '尚未进行过云端同步'
            }
            right={
              <Pressable onPress={() => void runSync()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.primaryFaint }}>
                <RefreshCw size={13} color={c.primaryDark} />
                <Text style={{ fontSize: fs(12), color: c.primaryDark }}>{syncing ? '同步中' : '立即同步'}</Text>
              </Pressable>
            }
          />
        </Group>

        {conflicts.length > 0 && (
          <Card style={{ marginBottom: 14, backgroundColor: c.warningSoft, borderColor: c.warning }}>
            <Text style={[t.h3, { color: c.text }]}>发现 {conflicts.length} 条同步冲突</Text>
            <Text style={[t.sub, { marginTop: 4, marginBottom: 12 }]}>云端与本机存在不同版本的修改，请手动选择保留策略。</Text>
            <Button title="前往处理冲突" size="md" onPress={() => router.push('/sync-conflict')} />
          </Card>
        )}

        {account ? (
          <Group>
            <Row title="退出登录" onPress={() => void logout()} chevron={false} />
            <Row title="注销账号" danger subtitle="永久清除云端数据" onPress={() => router.push('/settings/delete-account')} />
          </Group>
        ) : (
          <Button title="登录 / 注册账号" onPress={() => router.push('/auth/login')} style={{ marginTop: 6 }} />
        )}
      </ScrollView>
    </Screen>
  );
}
