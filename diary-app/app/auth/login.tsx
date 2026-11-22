import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { Lock, ShieldCheck, User } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { cloudConfigured } from '../../src/services/cloud';
import { captchaGateActive, withOtpTicket } from '../../src/services/mailgate';
import { CaptchaSheet } from '../../src/components/captchaSheet';
import { isEmail, isPhone } from '../../src/utils/text';
import { Button, Field, NavBar, Screen } from '../../src/components/ui';
import { BotanicalAccent } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';

/** 6. 登录页（1:1 复刻设计稿1 #6） */
export default function LoginScreen() {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const onboarded = useStore(s => s.onboarded);
  const knownAccounts = useStore(s => s.accounts);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeMode, setCodeMode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);

  const remoteSend = async () => {
    const id = identifier.trim();
    const res = await actions.sendLoginCode(id);
    if (!res.ok) {
      toast(res.message || '验证码发送失败', { type: 'error' });
      return;
    }
    setCountdown(60);
    const tmr = setInterval(() => setCountdown(v => {
      if (v <= 1) clearInterval(tmr);
      return v - 1;
    }), 1000);
    toast(isPhone(id) ? '验证码已发送，请查收短信' : '验证码已发送，请查收邮件（含垃圾箱）', { type: 'info' });
  };

  const sendCode = async () => {
    const id = identifier.trim();
    if (!isPhone(id) && !isEmail(id)) {
      toast('请先输入正确的手机号或邮箱', { type: 'warning' });
      return;
    }
    if (captchaGateActive() && cloudConfigured()) {
      setCaptchaOpen(true);
      return;
    }
    await remoteSend();
  };

  const submit = async () => {
    if (!identifier.trim()) {
      toast('请输入手机号或邮箱', { type: 'warning' });
      return;
    }
    if (codeMode) {
      if (!code.trim()) {
        toast('请输入验证码', { type: 'warning' });
        return;
      }
      setLoading(true);
      const res = await actions.loginByCode(identifier.trim(), code.trim());
      setLoading(false);
      if (!res.ok) {
        toast(res.message || '登录失败', { type: 'error' });
        return;
      }
      if (!onboarded) actions.completeOnboarding('account');
      toast('登录成功');
      router.replace('/shelf');
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
    router.replace('/shelf');
  };

  return (
    <Screen edges={['top']} keyboard>
      <BotanicalAccent color={c.primarySoft} />
      <NavBar back />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 14 }}>
          <Text style={[t.h1, { fontSize: fs(26), letterSpacing: 1 }]}>登录记得日记</Text>
          <Text style={[t.sub, { fontSize: fs(13.5), marginTop: 8 }]}>
            {cloudConfigured() ? '登录后，日记可在多台设备间安全同步。' : '登录本机账号，可在同一设备的账号间同步日记。'}
          </Text>

          <View style={{ marginTop: 28 }}>
            <Field
              icon={User}
              placeholder="手机号 / 邮箱"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {codeMode ? (
              <Field
                icon={ShieldCheck}
                placeholder="验证码"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                right={
                  <Pressable disabled={countdown > 0} onPress={() => void sendCode()} hitSlop={8}>
                    <Text style={{ fontSize: fs(13), color: countdown > 0 ? c.textMuted : c.primaryDark, fontWeight: '500' }}>
                      {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                    </Text>
                  </Pressable>
                }
              />
            ) : (
              <Field
                icon={Lock}
                placeholder="密码"
                value={password}
                onChangeText={setPassword}
                secure
              />
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              {cloudConfigured() ? (
                <Pressable hitSlop={8} onPress={() => setCodeMode(v => !v)}>
                  <Text style={{ fontSize: fs(13), color: c.primaryDark }}>{codeMode ? '密码登录' : '验证码登录'}</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable hitSlop={8} onPress={() => router.push('/auth/forgot')}>
                <Text style={{ fontSize: fs(13), color: c.textSub }}>忘记密码?</Text>
              </Pressable>
            </View>
            <Button title="登录" onPress={() => void submit()} loading={loading} />

            {knownAccounts.length > 0 && (
              <View style={{ marginTop: 18 }}>
                <Text style={{ fontSize: fs(12), color: c.textMuted, marginBottom: 8 }}>本机登录过的账号</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {knownAccounts.map(a => (
                    <Pressable
                      key={a.id}
                      accessibilityRole="button"
                      accessibilityLabel={`使用账号 ${a.identifier}`}
                      onPress={() => void (async () => {
                        const res = await actions.quickSwitchTo(a.id);
                        if (res.ok) { toast('已切换账号'); router.replace('/shelf'); return; }
                        setIdentifier(a.identifier);
                      })()}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: c.card, borderWidth: 1, borderColor: c.divider }}
                    >
                      <Text style={{ fontSize: fs(12), color: c.textSub }}>{a.identifier}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          <Pressable onPress={() => router.push('/auth/register')} style={{ alignItems: 'center', marginTop: 22 }}>
            <Text style={{ fontSize: fs(13), color: c.textSub }}>
              还没有账号? <Text style={{ color: c.primaryDark, fontWeight: '600' }}>立即注册</Text>
            </Text>
          </Pressable>
        </View>
      </View>

      <CaptchaSheet
        visible={captchaOpen}
        onCancel={() => setCaptchaOpen(false)}
        onSolved={ticket => {
          setCaptchaOpen(false);
          void withOtpTicket(ticket, remoteSend);
        }}
      />
    </Screen>
  );
}
