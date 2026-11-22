import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { Cloud, RefreshCw, Smartphone } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore, useSyncProgress } from '../../src/store/store';
import { Button, Card, Group, NavBar, Radio, Row, Screen, Switch } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { fmtDateTime } from '../../src/utils/date';
import { cloudConfigured } from '../../src/services/cloud';

/** 3. 账号与同步（1:1 复刻设计稿3 #3） */
export default function AccountSyncScreen() {
  const { c, t, fs, dark } = useTheme();
  const { toast, confirm } = useFeedback();
  const account = useStore(s => s.account);
  const accounts = useStore(s => s.accounts);
  const guestCount = useStore(s => s.accountSpaces?.guest?.entries.length ?? 0);
  const usageMode = useStore(s => s.usageMode);
  const sync = useStore(s => s.sync);
  const conflicts = useStore(s => s.conflicts);
  const progress = useSyncProgress();
  const syncing = progress.status === 'syncing';

  const isLocal = !account || usageMode === 'local';

  const runSync = async () => {
    if (!account) {
      toast('请先登录账号后再开启同步', { type: 'info' });
      router.push('/auth/login');
      return;
    }
    if (syncing) return;
    const res = await actions.syncNow();
    if (!res.ok) {
      toast(res.message || '同步失败', { type: 'error' });
      return;
    }
    if (res.conflicts > 0) {
      router.push('/sync-conflict');
    } else {
      toast(account.remote ? resultMessage(res.partial) : '本机账号快照已更新');
    }
  };

  const resultMessage = (partial?: boolean) => partial ? '部分内容已同步；已关闭的类别保留在本机' : '当前日记已同步完成';

  const logout = async () => {
    const ok = await confirm({
      title: '退出当前账号？',
      message: '退出后将显示本地模式的日记。当前账号日记会保留在独立空间，再次登录本账号即可查看。',
      confirmText: '退出登录',
    });
    if (!ok) return;
    try { await actions.logout(); toast('已退出登录'); } catch (e) { toast(e instanceof Error ? e.message : '退出失败，请重试', { type: 'error' }); }
  };

  const quickSwitch = async (accountId: string) => {
    const res = await actions.quickSwitchTo(accountId);
    if (res.ok) {
      toast('已切换账号');
      return;
    }
    if (res.needsLogin) {
      toast('该账号需重新验证，已为你转到登录页', { type: 'info' });
      router.push('/auth/login');
      return;
    }
    toast('切换失败，请重试', { type: 'error' });
  };

  const addAccount = async () => {
    const ok = await confirm({
      title: '登录新账号？',
      message: '当前账号的日记保留在独立空间、会话保留在本机，之后可在账号列表一键切回。',
      confirmText: '去登录',
    });
    if (!ok) return;
    try {
      await actions.prepareAddAccount();
      router.push('/auth/login');
    } catch (e) { toast(e instanceof Error ? e.message : '操作失败，请重试', { type: 'error' }); }
  };

  const syncSummary = [
    '日记',
    sync.syncPhotos ? '照片、视频、录音' : null,
    sync.syncTags ? '标签、人物、日记本' : null,
    sync.syncSettings ? '外观、提醒、目标' : null,
  ]
    .filter(Boolean)
    .join('、');

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
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
              <Text style={[t.sub, { marginTop: 3 }]}>
                {account
                  ? account.identifier
                  : cloudConfigured()
                    ? '点击登录或注册，多设备同步日记'
                    : '登录本机账号，数据按账号独立保存'}
              </Text>
            </View>
            <Radio checked={!!account} />
          </Pressable>
        </View>

        <Group title="同步与数据">
          <Row
            title={cloudConfigured() ? '云端同步' : '账号同步（本机）'}
            subtitle={cloudConfigured() ? '同步到云端，多设备可访问同一账号的日记' : '尚未接入云端；换设备请用备份文件迁移'}
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
            subtitle="无法识别网络类型时暂停同步；确认网络后可关闭此限制"
            right={<Switch value={sync.wifiOnly} onChange={v => actions.setSync({ wifiOnly: v })} />}
          />
          <Row
            title="同步照片、视频与录音"
            subtitle="附件实际上传到云存储；单次新增附件合计上限 25 MiB"
            right={<Switch value={sync.syncPhotos} onChange={v => actions.setSync({ syncPhotos: v })} />}
          />
          <Row
            title="同步标签、人物与日记本"
            right={
              <Switch
                value={sync.syncTags}
                onChange={v => actions.setSync({ syncTags: v })}
              />
            }
          />
          <Row title="同步外观、提醒与目标" subtitle="同一设置同时修改时保留本机选择；设备锁与 AI 密钥不上传" right={<Switch value={sync.syncSettings} onChange={v => actions.setSync({ syncSettings: v })} />} />
          <Row
            title="同步内容"
            subtitle={syncSummary}
          />
          <Row
            title="上次同步"
            subtitle={
              progress.status === 'error' ? progress.message : conflicts.length
                ? `检测到 ${conflicts.length} 处同步冲突，请及时处理`
                : sync.lastSyncAt
                  ? `${fmtDateTime(sync.lastSyncAt)} · 上次完成`
                  : cloudConfigured() ? '尚未进行过云端同步' : '尚未同步过'
            }
            right={
              <Pressable disabled={syncing} accessibilityState={{ disabled: syncing }} onPress={() => void runSync()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.primaryFaint }}>
                <RefreshCw size={13} color={c.primaryDark} />
                <Text style={{ fontSize: fs(12), color: c.primaryDark }}>{syncing ? '同步中' : '立即同步'}</Text>
              </Pressable>
            }
          />
        </Group>

        {conflicts.length > 0 && (
          <Card style={{ marginBottom: 14, backgroundColor: c.warningSoft, borderColor: c.warning }}>
            <Text style={[t.h3, { color: c.text }]}>发现 {conflicts.length} 条同步冲突</Text>
            <Text style={[t.sub, { marginTop: 4, marginBottom: 12 }]}>
              {cloudConfigured() ? '云端与本机对同一篇日记有不同修改' : '本机与本账号快照有不同修改'}，请手动选择保留方式。
            </Text>
            <Button title="前往处理冲突" size="md" onPress={() => router.push('/sync-conflict')} />
          </Card>
        )}

        {account && guestCount > 0 && <Group><Row title={`导入本地模式的 ${guestCount} 篇日记`} subtitle="不同账号默认独立；只有确认后才复制到当前账号" onPress={() => void (async () => {
          if (await confirm({ title: '复制本地模式的日记到当前账号？', message: '将创建独立副本，原本地日记保留。之后同步会上传到当前账号。', confirmText: '复制日记' })) { const count = actions.importLocalDiaries(); toast(`已复制 ${count} 篇日记`); }
        })()} /></Group>}

        {accounts.length > 0 && (
          <Group title="本机账号" footer="云端账号在会话有效期内可一键免密切换；本机账号直接切换。">
            {accounts.map(a => (
              <Row
                key={a.id}
                title={a.nickname || a.identifier}
                subtitle={`${a.identifier}${a.id === account?.id ? ' · 当前' : a.remote ? ' · 云端' : ''}`}
                right={a.id === account?.id ? <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '600' }}>使用中</Text> : undefined}
                onPress={a.id === account?.id ? undefined : () => void quickSwitch(a.id)}
              />
            ))}
            <Row title="登录新账号" subtitle="添加一个账号；已有账号可随时切回" onPress={() => void addAccount()} />
          </Group>
        )}

        {account ? (
          <Group>
            <Row title="退出登录" onPress={() => void logout()} chevron={false} />
            <Row title="注销账号" danger subtitle={cloudConfigured() ? '永久删除云端账号与数据' : '永久删除本机账号与数据'} onPress={() => router.push('/settings/delete-account')} />
          </Group>
        ) : (
          <Button title="登录 / 注册账号" onPress={() => router.push('/auth/login')} style={{ marginTop: 6 }} />
        )}
      </ScrollView>
    </Screen>
  );
}
