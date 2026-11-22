import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, ShieldCheck, User } from 'lucide-react-native';
import { useIllustrations, useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Checkbox, Field, NavBar, Screen } from '../../src/components/ui';
import { BotanicalAccent } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';
import { BottomSheet } from '../../src/components/motion';
import { isEmail, isPhone } from '../../src/utils/text';
import { cloudConfigured } from '../../src/services/cloud';
import { captchaGateActive, withOtpTicket } from '../../src/services/mailgate';
import { CaptchaSheet } from '../../src/components/captchaSheet';

/** 7. 注册页（1:1 复刻设计稿1 #7） */
export default function RegisterScreen() {
  const { c, t, fs, dark } = useTheme();
  const pack = useIllustrations();
  const { toast } = useFeedback();
  const onboarded = useStore(s => s.onboarded);
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [password, setPassword] = useState('');
  // 密码在发码时随 signUp 写入账号；发码后再改密码需重新获取验证码
  const [passwordAtSend, setPasswordAtSend] = useState('');
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [docModal, setDocModal] = useState<'terms' | 'privacy' | null>(null);
  // 面板收起的动画期间继续显示刚才那份文档
  const lastDoc = useRef(docModal);
  if (docModal) lastDoc.current = docModal;
  const shownDoc = docModal ?? lastDoc.current;

  useEffect(() => {
    if (countdown <= 0) return;
    const tmr = setTimeout(() => setCountdown(v => v - 1), 1000);
    return () => clearTimeout(tmr);
  }, [countdown]);

  const remoteSend = async () => {
    const id = identifier.trim();
    const res = await actions.sendRegisterCode(id, password);
    if (!res.ok) {
      toast(res.message || '验证码发送失败', { type: 'error' });
      return;
    }
    setSentCode('remote');
    setPasswordAtSend(password);
    setCountdown(60);
    toast(isPhone(id) ? '验证码已发送，请查收短信' : '验证码已发送，请查收邮件（含垃圾箱）', { type: 'info' });
  };

  const sendCode = async () => {
    const id = identifier.trim();
    if (!isPhone(id) && !isEmail(id)) {
      toast('请先输入正确的手机号或邮箱', { type: 'warning' });
      return;
    }
    if (!cloudConfigured()) {
      const gen = '668822';
      setSentCode(gen);
      setCountdown(60);
      toast(`验证码已发送：${gen}`, { type: 'info', message: '本地演示模式下已自动生成验证码' });
      return;
    }
    if (password.length < 6 || password.length > 20) {
      toast('请先填写 6-20 位密码，再获取验证码', { type: 'warning' });
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
    const remote = cloudConfigured();
    if (!isPhone(id) && !isEmail(id)) {
      toast('请输入有效的手机号或邮箱', { type: 'warning' });
      return;
    }
    if (!code.trim() || (sentCode && sentCode !== 'remote' && code.trim() !== sentCode)) {
      toast('请输入正确的验证码', { type: 'warning' });
      return;
    }
    if (password.length < 6 || password.length > 20) {
      toast('密码长度需在 6-20 位之间', { type: 'warning' });
      return;
    }
    if (remote && sentCode === 'remote' && password !== passwordAtSend) {
      toast('密码已修改，请重新获取验证码', { type: 'warning' });
      return;
    }
    if (!agreed) {
      toast('请先阅读并勾选同意用户协议与隐私政策', { type: 'warning' });
      return;
    }
    setLoading(true);
    const res = remote
      ? await actions.loginByCode(id, code.trim())
      : await actions.register(id, password);
    setLoading(false);
    if (!res.ok) {
      toast(res.message || '注册失败', { type: 'error' });
      return;
    }
    if (!onboarded) actions.completeOnboarding('account');
    toast('注册成功，欢迎来到记得日记');
    router.replace('/shelf');
  };

  return (
    <Screen edges={['top']} keyboard>
      <BotanicalAccent color={c.primarySoft} />
      <NavBar back />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 10 }}>
          <Text style={[t.h1, { fontSize: fs(26), letterSpacing: 1 }]}>注册记得日记</Text>
          <Text style={[t.sub, { fontSize: fs(13.5), marginTop: 8 }]}>创建账号，开启你的日记之旅。</Text>

          <View style={{ marginTop: 24 }}>
            <Field icon={User} placeholder="手机号 / 邮箱" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" keyboardType="email-address" />
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
            <Field icon={Lock} placeholder={cloudConfigured() ? '设置密码 (6-20位，用于密码登录)' : '设置密码 (6-20位)'} value={password} onChangeText={setPassword} secure />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 20 }}>
              <Checkbox checked={agreed} onChange={setAgreed} size={16} />
              <Text style={{ fontSize: fs(12), color: c.textSub, flex: 1 }}>
                我已阅读并同意{' '}
                <Text onPress={() => setDocModal('terms')} style={{ color: c.primaryDark }}>《用户协议》</Text>
                {' '}和{' '}
                <Text onPress={() => setDocModal('privacy')} style={{ color: c.primaryDark }}>《隐私政策》</Text>
              </Text>
            </View>

            <Button title="注册" onPress={() => void submit()} loading={loading} />
          </View>

          <Pressable onPress={() => router.back()} style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ fontSize: fs(13), color: c.textSub }}>
              已有账号? <Text style={{ color: c.primaryDark, fontWeight: '600' }}>去登录</Text>
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 140, width: '100%', overflow: 'hidden' }}>
          <Image source={pack.cover as any} style={{ width: '100%', height: '100%', opacity: dark ? 0.3 : 0.85 }} resizeMode="cover" />
          <LinearGradient colors={[c.bg, 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70 }} />
        </View>
      </View>

      <BottomSheet visible={!!docModal} onClose={() => setDocModal(null)} maxHeight={0.75}>
          <View style={{ flexShrink: 1, paddingTop: 6 }}>
            <Text style={[t.h2, { marginBottom: 12 }]}>{shownDoc === 'terms' ? '用户协议' : '隐私政策'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[t.body, { fontSize: fs(14), color: c.textSub, lineHeight: fs(14) * 1.75 }]}>
                {shownDoc === 'terms'
                  ? '欢迎使用「记得日记」。\n\n1. 本地优先：你的所有日记内容、图片、录音与标签默认保存在本机，你对自己的内容拥有完整控制权。\n2. 账号与同步：登录本机账号后，日记可在同一设备的账号之间同步；跨设备的云端同步将在后续版本提供。\n3. 数据导出：你可以随时通过设置中的「导入与导出」将全部记录导出为 Markdown、PDF、纯文本或 JSON 格式。'
                  : '「记得日记」非常重视你的个人隐私。\n\n1. 我们仅在你主动点击插入照片、录制语音、获取当前位置或开启每日提醒时请求相应系统权限。\n2. 你可以随时在「隐私与安全」中开启应用锁密码、Face ID / 指纹识别或隐藏日记功能。\n3. 你可以随时手动备份、清空本地数据或永久注销账号。\n4. 「记得」AI 助手默认关闭。开启后，只有你主动操作的日记文字会发送到你自行配置的服务；照片、视频、录音、位置不会发送，隐藏与已删除的日记永远不会发送。'}
              </Text>
            </ScrollView>
            <Button title="我知道了" onPress={() => setDocModal(null)} style={{ marginTop: 18 }} />
          </View>
      </BottomSheet>

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
