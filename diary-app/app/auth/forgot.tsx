import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { Lock, ShieldCheck, User } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions } from '../../src/store/store';
import { cloudConfigured } from '../../src/services/cloud';
import { captchaGateActive, withOtpTicket } from '../../src/services/mailgate';
import { CaptchaSheet } from '../../src/components/captchaSheet';
import { isEmail, isPhone } from '../../src/utils/text';
import { Button, Field, NavBar, Screen, goBack } from '../../src/components/ui';
import { BotanicalAccent } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';

/** 8. 找回密码页（1:1 复刻设计稿1 #8） */
export default function ForgotPasswordScreen() {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const tmr = setTimeout(() => setCountdown(v => v - 1), 1000);
    return () => clearTimeout(tmr);
  }, [countdown]);

  const remoteSend = async () => {
    const id = identifier.trim();
    const res = await actions.sendResetCode(id);
    if (!res.ok) {
      toast(res.message || '发送失败', { type: 'error' });
      return;
    }
    setSentCode('remote');
    setCountdown(60);
    toast(isPhone(id) ? '验证码已发送，请查收短信' : '验证码已发送，请查收邮件（含垃圾箱）', { type: 'info' });
  };

  const sendCode = async () => {
    const id = identifier.trim();
    if (!id || (!isPhone(id) && !isEmail(id))) {
      toast('请先输入正确的手机号或邮箱', { type: 'warning' });
      return;
    }
    if (!cloudConfigured()) {
      const gen = '668822';
      setSentCode(gen);
      setCountdown(60);
      toast(`验证码已发送：${gen}`, { type: 'info' });
      return;
    }
    if (captchaGateActive()) {
      setCaptchaOpen(true);
      return;
    }
    await remoteSend();
  };

  const submit = async () => {
    const id = identifier.trim();
    if (!id) {
      toast('请输入手机号或邮箱', { type: 'warning' });
      return;
    }
    if (!code.trim() || (sentCode && sentCode !== 'remote' && code.trim() !== sentCode)) {
      toast('请输入正确的验证码', { type: 'warning' });
      return;
    }
    if (password.length < 6 || password.length > 20) {
      toast('新密码长度需在 6-20 位之间', { type: 'warning' });
      return;
    }
    setLoading(true);
    const res = await actions.resetPassword(id, password, code.trim());
    setLoading(false);
    if (!res.ok) {
      toast(res.message || '重置失败', { type: 'error' });
      return;
    }
    if (res.account) {
      toast('密码已重置，已为你登录');
      router.replace('/shelf');
      return;
    }
    toast('密码已重置，请使用新密码登录');
    router.replace('/auth/login');
  };

  return (
    <Screen edges={['top']} keyboard>
      <BotanicalAccent color={c.primarySoft} />
      <NavBar back />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 14 }}>
          <Text style={[t.h1, { fontSize: fs(26), letterSpacing: 1 }]}>找回密码</Text>
          <Text style={[t.sub, { fontSize: fs(13.5), marginTop: 8 }]}>通过手机号或邮箱验证，重置你的密码。</Text>

          <View style={{ marginTop: 28 }}>
            <Field icon={User} placeholder="手机号 / 邮箱" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
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
            <Field icon={Lock} placeholder="新密码 (6-20位)" value={password} onChangeText={setPassword} secure />
            <Button title="重置密码" onPress={() => void submit()} loading={loading} style={{ marginTop: 8 }} />
          </View>

          <Pressable onPress={goBack} style={{ alignItems: 'center', marginTop: 22 }}>
            <Text style={{ fontSize: fs(13), color: c.textSub }}>返回登录</Text>
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
