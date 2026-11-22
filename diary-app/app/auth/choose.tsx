import React from 'react';
import { View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { ChevronRight, Cloud, Smartphone } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions } from '../../src/store/store';
import { Card, NavBar, Screen, haptic } from '../../src/components/ui';
import { cloudConfigured } from '../../src/services/cloud';

/** 5. 选择使用方式 */
export default function ChooseModeScreen() {
  const { c, t, fs, r } = useTheme();

  const pickLocal = () => {
    haptic('medium');
    actions.completeOnboarding('local');
    router.replace('/shelf');
  };

  return (
    <Screen edges={['top']}>
      <NavBar back />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <Text style={[t.h1, { fontSize: fs(26), letterSpacing: 1 }]}>选择使用方式</Text>
          <Text style={[t.sub, { fontSize: fs(14), marginTop: 10 }]}>两种方式，随心开始。</Text>

          <View style={{ gap: 16, marginTop: 32 }}>
            <Card
              onPress={pickLocal}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}
            >
              <View style={{ width: 46, height: 46, borderRadius: r(14), backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Smartphone size={22} color={c.primaryDark} strokeWidth={1.7} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[t.h3, { fontSize: fs(17) }]}>先本地使用</Text>
                <Text style={[t.sub, { marginTop: 5 }]}>不登录也能直接用，数据仅存当前设备中。</Text>
              </View>
              <ChevronRight size={20} color={c.textMuted} style={{ marginLeft: 8 }} />
            </Card>

            <Card
              onPress={() => router.push('/auth/login')}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}
            >
              <View style={{ width: 46, height: 46, borderRadius: r(14), backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Cloud size={22} color={c.primaryDark} strokeWidth={1.7} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[t.h3, { fontSize: fs(17) }]}>登录账号</Text>
                <Text style={[t.sub, { marginTop: 5 }]}>
                  {cloudConfigured() ? '登录云端账号，多设备同步日记。' : '创建本机账号，可在同设备账号间同步日记；云端同步暂未开放。'}
                </Text>
              </View>
              <ChevronRight size={20} color={c.textMuted} style={{ marginLeft: 8 }} />
            </Card>
          </View>
        </View>
        <Text style={{ fontSize: fs(12.5), color: c.textMuted, textAlign: 'center', paddingHorizontal: 32, paddingBottom: 28, lineHeight: fs(20) }}>
          之后也可以在「我的 · 账号与同步」登录；本地写的日记会继续留在这台设备上。
        </Text>
      </View>
    </Screen>
  );
}
