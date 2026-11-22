import React, { useState } from 'react';
import { Alert, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Bell, BookMarked, Cloud, Download, HardDrive, Info, Palette, RefreshCw, Shield, Sparkles, Target, Type } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useStore } from '../../src/store/store';
import { APP_VERSION } from '../../src/data/constants';
import { Group, NavBar, Row, Screen } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';

/** 2. 设置页（1:1 复刻设计稿3 #2） */
export default function SettingsIndexScreen() {
  const { c } = useTheme();
  const { toast } = useFeedback();
  const [checking, setChecking] = useState(false);
  const account = useStore(s => s.account);
  const notebooks = useStore(s => s.notebooks);
  const goals = useStore(s => s.goals);
  const ai = useStore(s => s.ai);

  // EAS Update 热更新：检查 → 下载 → 提示重启生效（仅原生端）
  const checkUpdate = async () => {
    setChecking(true);
    try {
      const Updates = await import('expo-updates');
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) {
        toast('已是最新版本');
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('发现新版本', '已下载完成，重启应用即可生效。', [
        { text: '稍后', style: 'cancel' },
        { text: '立即重启', onPress: () => void Updates.reloadAsync() },
      ]);
    } catch {
      toast('检查更新失败，请稍后再试', { type: 'error' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="设置" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <Group title="账号">
          <Row
            icon={Cloud}
            iconColor={c.primaryDark}
            title="账号与同步"
            subtitle="本地保存与云端同步状态"
            value={account ? '已登录' : '本地使用'}
            onPress={() => router.push('/settings/account')}
          />
        </Group>
        <Group title="记录与回顾">
          <Row
            icon={BookMarked}
            iconColor={c.primaryDark}
            title="我的日记本"
            subtitle="新建、分类管理你的日记本"
            value={`${notebooks.length} 本`}
            onPress={() => router.push('/notebooks')}
          />
          <Row
            icon={Target}
            iconColor={c.primaryDark}
            title="写作目标"
            subtitle="每日字数目标与连续达标记录"
            value={goals.enabled ? `${goals.dailyWords} 字` : '未开启'}
            onPress={() => router.push('/settings/goals')}
          />
          <Row
            icon={Bell}
            iconColor={c.primaryDark}
            title="提醒通知"
            subtitle="每日提醒、重要事项提醒"
            onPress={() => router.push('/settings/reminders')}
          />
          <Row
            icon={Sparkles}
            iconColor={c.primaryDark}
            title="记得（AI 助手）"
            subtitle="追问、整理、回信与周回顾"
            value={ai.enabled ? '已开启' : '未开启'}
            onPress={() => router.push('/settings/ai')}
          />
        </Group>
        <Group title="外观与阅读">
          <Row
            icon={Palette}
            iconColor={c.primaryDark}
            title="外观主题"
            subtitle="明暗模式、风格与主题颜色"
            onPress={() => router.push('/settings/appearance')}
          />
          <Row
            icon={Type}
            iconColor={c.primaryDark}
            title="字体与排版"
            subtitle="正文宽度、行距、卡片样式"
            onPress={() => router.push('/settings/typography')}
          />
        </Group>
        <Group title="隐私与数据">
          <Row
            icon={Shield}
            iconColor={c.primaryDark}
            title="隐私与安全"
            subtitle="应用锁、加密与隐私设置"
            onPress={() => router.push('/settings/privacy')}
          />
          <Row
            icon={HardDrive}
            iconColor={c.primaryDark}
            title="备份与恢复"
            subtitle="加密备份、自动快照与恢复"
            onPress={() => router.push('/settings/backup')}
          />
          <Row
            icon={Download}
            iconColor={c.primaryDark}
            title="导入与导出"
            subtitle="Markdown、PDF 等格式"
            onPress={() => router.push('/settings/transfer')}
          />
        </Group>
        <Group title="应用">
          {Platform.OS !== 'web' && (
            <Row
              icon={RefreshCw}
              iconColor={c.primaryDark}
              title="检查更新"
              subtitle={checking ? '正在检查…' : '下载并应用最新版本'}
              onPress={() => void checkUpdate()}
            />
          )}
          <Row
            icon={Info}
            iconColor={c.primaryDark}
            title="关于"
            subtitle={`版本 ${APP_VERSION}`}
            onPress={() => router.push('/settings/about')}
          />
        </Group>
      </ScrollView>
    </Screen>
  );
}
