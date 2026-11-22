import React, { useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { EyeOff, Fingerprint, KeyRound, Lock, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Group, NavBar, Row, Screen, Switch } from '../../src/components/ui';
import { PinModal } from '../../src/components/LockGate';
import { useFeedback } from '../../src/components/feedback';

const DELAY_LABEL = { 0: '立即锁定', 60: '1 分钟后', 300: '5 分钟后' } as const;

/** 8. 隐私与安全（1:1 复刻设计稿3 #8 + 清空所有数据） */
export default function PrivacyScreen() {
  const { c } = useTheme();
  const { toast, confirm, sheet } = useFeedback();
  const privacy = useStore(s => s.privacy);
  const hiddenCount = useStore(s => s.entries.filter(e => !e.deletedAt && e.hidden).length);

  const [pinMode, setPinMode] = useState<'setup' | 'verify' | null>(null);
  const [pinPurpose, setPinPurpose] = useState<'enable' | 'change' | 'disable'>('enable');

  const toggleAppLock = (v: boolean) => {
    if (v) {
      setPinPurpose('enable');
      setPinMode('setup');
    } else if (privacy.passcodeHash) {
      setPinPurpose('disable');
      setPinMode('verify');
    } else {
      actions.disableAppLock();
    }
  };

  const toggleBiometric = async (v: boolean) => {
    if (!v) {
      actions.setPrivacy({ biometric: false });
      return;
    }
    if (!privacy.appLock) {
      toast('请先开启应用锁并设置数字密码', { type: 'info' });
      return;
    }
    if (Platform.OS === 'web') {
      actions.setPrivacy({ biometric: true });
      toast('已开启快速解锁');
      return;
    }
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!has || !enrolled) {
      toast('当前设备未检测到可用的 Face ID 或指纹', { type: 'warning' });
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: '验证生物识别以开启快速解锁' });
    if (res.success) {
      actions.setPrivacy({ biometric: true });
      toast('已开启生物识别解锁');
    }
  };

  const chooseDelay = () => {
    sheet(
      [
        { label: '离开后立即锁定', onPress: () => actions.setPrivacy({ lockDelay: 0 }) },
        { label: '离开 1 分钟后锁定', onPress: () => actions.setPrivacy({ lockDelay: 60 }) },
        { label: '离开 5 分钟后锁定', onPress: () => actions.setPrivacy({ lockDelay: 300 }) },
      ],
      '选择自动锁定时间',
    );
  };

  const wipeAllData = async () => {
    const ok = await confirm({
      title: '清空所有数据',
      message: '将删除本地的全部日记、图片与设置。该操作不可撤销。',
      confirmText: '确认清空',
      destructive: true,
      icon: 'danger',
    });
    if (!ok) return;
    await actions.wipeAll();
    toast('本地数据已全部清空');
    router.replace('/onboarding');
  };

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar variant="large" title="隐私与安全" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <Group>
          <Row
            icon={Lock}
            iconColor={c.primaryDark}
            title="应用锁"
            subtitle="开启后，进入应用需验证身份"
            right={<Switch value={privacy.appLock} onChange={toggleAppLock} />}
          />
          <Row
            icon={KeyRound}
            iconColor={c.primaryDark}
            title="解锁方式"
            value={privacy.biometric ? 'Face ID（推荐）' : privacy.appLock ? `密码 · ${DELAY_LABEL[privacy.lockDelay]}` : '未开启'}
            onPress={() => {
              if (!privacy.appLock) {
                toggleAppLock(true);
              } else {
                sheet([
                  {
                    label: '修改应用锁密码',
                    onPress: () => {
                      setPinPurpose('change');
                      setPinMode('setup');
                    },
                  },
                  { label: `自动锁定延迟（${DELAY_LABEL[privacy.lockDelay]}）`, onPress: chooseDelay },
                ]);
              }
            }}
          />
          <Row
            icon={Fingerprint}
            iconColor={c.primaryDark}
            title="生物识别"
            subtitle="使用 Face ID / 指纹快速解锁"
            right={<Switch value={privacy.biometric} onChange={v => void toggleBiometric(v)} />}
          />
        </Group>

        <Group>
          <Row
            icon={EyeOff}
            iconColor={c.primaryDark}
            title="隐藏日记验证"
            subtitle="开启应用锁后，查看隐藏日记需再次验证"
            right={<Switch value={privacy.lockHidden} onChange={v => actions.setPrivacy({ lockHidden: v })} />}
          />
          <Row
            title="查看隐藏日记"
            value={hiddenCount ? `${hiddenCount} 篇` : '暂无'}
            onPress={() => router.push('/hidden')}
          />
        </Group>

        <Group>
          <Row
            icon={ShieldCheck}
            iconColor={c.primaryDark}
            title="加密备份"
            subtitle="以加密方式备份数据，提升安全性"
            right={<Switch value={privacy.encryptBackup} onChange={v => actions.setPrivacy({ encryptBackup: v })} />}
          />
        </Group>

        <Group>
          <Row
            icon={Trash2}
            title="清空所有数据"
            subtitle="删除本地的全部日记、图片与设置"
            danger
            chevron={false}
            onPress={() => void wipeAllData()}
          />
        </Group>
      </ScrollView>

      <PinModal
        visible={pinMode !== null}
        mode={pinMode ?? 'setup'}
        onClose={() => setPinMode(null)}
        onSuccess={() => {
          setPinMode(null);
          if (pinPurpose === 'disable') {
            actions.disableAppLock();
            toast('已关闭应用锁');
          } else if (pinPurpose === 'change') {
            toast('应用锁密码已更新');
          } else {
            toast('已开启应用锁');
          }
        }}
      />
    </Screen>
  );
}
