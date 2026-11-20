import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, User } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Field, NavBar, Screen } from '../../src/components/ui';
import { BotanicalAccent } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';
import { IMAGES } from '../../src/data/assets';

/** 6. 登录页（1:1 复刻设计稿1 #6） */
export default function LoginScreen() {
  const { c, t, fs, dark } = useTheme();
  const { toast } = useFeedback();
  const onboarded = useStore(s => s.onboarded);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!identifier.trim()) {
      toast('请输入手机号或邮箱', { type: 'warning' });
      return;
    }
    if (password.length < 6) {
      toast('请输入至少 6 位密码', { type: 'warning' });
      return;
    }
    setLoading(true);
    const res = await actions.login(identifier, password);
    setLoading(false);
    if (!res.ok) {
      toast(res.message || '登录失败', { type: 'error' });
      return;
    }
    if (!onboarded) actions.completeOnboarding('account');
    toast('登录成功');
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top']} keyboard>
      <BotanicalAccent color={c.primarySoft} />
      <NavBar back />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 14 }}>
          <Text style={[t.h1, { fontSize: fs(26), letterSpacing: 1 }]}>登录记得日记</Text>
          <Text style={[t.sub, { fontSize: fs(13.5), marginTop: 8 }]}>登录本机账号，可在同一设备的账号间同步日记。</Text>

          <View style={{ marginTop: 28 }}>
            <Field
              icon={User}
              placeholder="手机号 / 邮箱"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              icon={Lock}
              placeholder="密码"
              value={password}
              onChangeText={setPassword}
              secure
            />
            <View style={{ alignItems: 'flex-end', marginBottom: 20 }}>
              <Pressable hitSlop={8} onPress={() => router.push('/auth/forgot')}>
                <Text style={{ fontSize: fs(13), color: c.textSub }}>忘记密码?</Text>
              </Pressable>
            </View>
            <Button title="登录" onPress={() => void submit()} loading={loading} />
          </View>

          <Pressable onPress={() => router.push('/auth/register')} style={{ alignItems: 'center', marginTop: 22 }}>
            <Text style={{ fontSize: fs(13), color: c.textSub }}>
              还没有账号? <Text style={{ color: c.primaryDark, fontWeight: '600' }}>立即注册</Text>
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 170, width: '100%', overflow: 'hidden' }}>
          <Image source={IMAGES.mountainsMist} style={{ width: '100%', height: '100%', opacity: dark ? 0.3 : 0.88 }} resizeMode="cover" />
          <LinearGradient colors={[c.bg, 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }} />
        </View>
      </View>
    </Screen>
  );
}
