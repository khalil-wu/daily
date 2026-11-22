import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { RefreshCw, ShieldCheck } from 'lucide-react-native';
import { Text } from './text';
import { useTheme } from '../theme/ThemeProvider';
import { BottomSheet } from './motion';
import { Button, Field } from './ui';
import { fetchCaptcha, solveCaptcha, type CaptchaChallenge } from '../services/mailgate';

/**
 * 发码前的图形验证弹层：答对后把一次性 ticket 交给调用方。
 * 仅 Web 使用——服务端核销 ticket 后才放行 /cb 发码请求。
 */
/** SVG 文本转 data URI；RN-web 对 utf8 直嵌的 data URI 应用不稳，base64 更可靠。 */
function svgToData(svg: string): string {
  return btoa(unescape(encodeURIComponent(svg)));
}

export function CaptchaSheet({ visible, onCancel, onSolved }: { visible: boolean; onCancel: () => void; onSolved: (ticket: string) => void }) {
  const { c, t, fs } = useTheme();
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    setAnswer('');
    try {
      setChallenge(await fetchCaptcha());
    } catch (e) {
      setChallenge(null);
      setError((e as Error).message || '验证服务暂不可用');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) void refresh();
  }, [visible]);

  const submit = async () => {
    if (!challenge || !answer.trim()) return;
    setLoading(true);
    setError('');
    try {
      const ticket = await solveCaptcha(challenge.id, answer.trim());
      onSolved(ticket);
    } catch (e) {
      setError((e as Error).message || '验证失败，请重试');
      void refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onCancel} title="安全验证" keyboard maxHeight={0.6}>
      <Text style={[t.sub, { fontSize: fs(13), marginBottom: 14 }]}>请输入图中的 4 位字符（不区分大小写），完成后即可获取验证码。</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <View style={{ width: 120, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f7f3ea', alignItems: 'center', justifyContent: 'center' }}>
          {loading && !challenge ? (
            <ActivityIndicator color={c.textMuted} />
          ) : challenge ? (
            <Image
              accessibilityLabel="图形验证码"
              source={{ uri: `data:image/svg+xml;base64,${svgToData(challenge.svg)}` }}
              style={{ width: 120, height: 44 }}
            />
          ) : (
            <ShieldCheck size={20} color={c.textMuted} />
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="换一张" onPress={() => void refresh()} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
          <RefreshCw size={14} color={c.primaryDark} />
          <Text style={{ fontSize: fs(13), color: c.primaryDark }}>换一张</Text>
        </Pressable>
      </View>
      <Field
        icon={ShieldCheck}
        placeholder="输入图中字符"
        value={answer}
        onChangeText={setAnswer}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        error={error || undefined}
        onSubmitEditing={() => void submit()}
      />
      <Button title="确认" onPress={() => void submit()} loading={loading} disabled={!challenge || answer.trim().length < 4} style={{ marginTop: 4 }} />
    </BottomSheet>
  );
}
