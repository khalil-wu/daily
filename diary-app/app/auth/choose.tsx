import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Cloud, Smartphone } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions } from '../../src/store/store';
import { NavBar, Screen, haptic } from '../../src/components/ui';
import { IMAGES } from '../../src/data/assets';

/** 5. 选择使用方式（1:1 复刻设计稿1 #5） */
export default function ChooseModeScreen() {
  const { c, t, fs, dark } = useTheme();

  const pickLocal = () => {
    haptic('medium');
    actions.completeOnboarding('local');
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top']}>
      <NavBar back />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <Text style={[t.h1, { fontSize: fs(26), letterSpacing: 1 }]}>选择使用方式</Text>
          <Text style={[t.sub, { fontSize: fs(14), marginTop: 10 }]}>两种方式，随心开始。</Text>

          <View style={{ gap: 16, marginTop: 32 }}>
            <Pressable
              onPress={pickLocal}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: c.card,
                borderRadius: 18,
                padding: 20,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: c.divider,
                shadowColor: c.shadow,
                shadowOpacity: dark ? 0 : 0.08,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Smartphone size={22} color={c.primaryDark} strokeWidth={1.7} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[t.h3, { fontSize: fs(17) }]}>先本地使用</Text>
                <Text style={[t.sub, { marginTop: 5 }]}>不登录也能直接用，数据仅存当前设备中。</Text>
              </View>
              <ChevronRight size={20} color={c.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/auth/login')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: c.card,
                borderRadius: 18,
                padding: 20,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: c.divider,
                shadowColor: c.shadow,
                shadowOpacity: dark ? 0 : 0.08,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Cloud size={22} color={c.primaryDark} strokeWidth={1.7} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[t.h3, { fontSize: fs(17) }]}>登录后同步</Text>
                <Text style={[t.sub, { marginTop: 5 }]}>登录账号，支持多设备同步，数据更安全。</Text>
              </View>
              <ChevronRight size={20} color={c.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>
          </View>
        </View>

        <View style={{ height: 220, width: '100%', overflow: 'hidden' }}>
          <Image source={IMAGES.mountainsMist} style={{ width: '100%', height: '100%', opacity: dark ? 0.35 : 0.9 }} resizeMode="cover" />
          <LinearGradient colors={[c.bg, 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90 }} />
        </View>
      </View>
    </Screen>
  );
}
