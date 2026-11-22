import React from 'react';
import { Image, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Cloud, Smartphone } from 'lucide-react-native';
import { useIllustrations, useTheme } from '../../src/theme/ThemeProvider';
import { actions } from '../../src/store/store';
import { Card, NavBar, Screen, haptic } from '../../src/components/ui';
import { cloudConfigured } from '../../src/services/cloud';

/** 5. 选择使用方式 */
export default function ChooseModeScreen() {
  const { c, t, fs, dark, r } = useTheme();
  const pack = useIllustrations();

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

        <View style={{ height: 224, width: '100%', overflow: 'hidden', backgroundColor: dark ? c.bgDeep : '#FFFFFF' }}>
          <Image source={pack.cover as any} style={{ width: '100%', height: '100%', opacity: dark ? 0.5 : 0.96 }} resizeMode="cover" />
          <LinearGradient colors={[c.bg, 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 64 }} />
        </View>
      </View>
    </Screen>
  );
}
