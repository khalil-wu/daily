import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Bell, BookMarked, Cloud, Download, HardDrive, Info, Palette, Shield, Target, Type } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useStore } from '../../src/store/store';
import { APP_VERSION } from '../../src/data/constants';
import { Group, NavBar, Row, Screen } from '../../src/components/ui';

/** 2. 设置页（1:1 复刻设计稿3 #2） */
export default function SettingsIndexScreen() {
  const { c } = useTheme();
  const account = useStore(s => s.account);
  const notebooks = useStore(s => s.notebooks);
  const goals = useStore(s => s.goals);

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="设置" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <Group>
          <Row
            icon={Cloud}
            iconColor={c.primaryDark}
            title="账号与同步"
            subtitle="本地使用、登录与数据同步"
            value={account ? '已登录' : '本地使用'}
            onPress={() => router.push('/settings/account')}
          />
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
            icon={Palette}
            iconColor={c.primaryDark}
            title="外观主题"
            subtitle="浅色 / 深色、强调色与字体"
            onPress={() => router.push('/settings/appearance')}
          />
          <Row
            icon={Type}
            iconColor={c.primaryDark}
            title="字体与排版"
            subtitle="正文宽度、行距、卡片样式"
            onPress={() => router.push('/settings/typography')}
          />
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
