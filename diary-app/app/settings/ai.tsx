import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../src/components/text';
import { BookOpenText, EyeOff, KeyRound, Link2, MessageCircleHeart, Sparkles, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Field, Group, NavBar, Row, Screen, Switch, haptic } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { PopDialog } from '../../src/components/motion';
import { apiHost, listModels } from '../../src/utils/ai/client';
import { clearAIKey, getAIKey, maskKey, setAIKey } from '../../src/services/aiKey';
import { useAIStatus } from '../../src/services/ai';

/**
 * 「记得」设置页。
 * 默认关闭。开启时必须先看清楚：发出什么、发给谁；隐藏日记永不发送；密钥只存在本机。
 */
export default function AISettingsScreen() {
  const { c, t, fs } = useTheme();
  const { toast, confirm } = useFeedback();
  const ai = useStore(s => s.ai);
  const status = useAIStatus();

  const [consentOpen, setConsentOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(ai.baseUrl);
  const [model, setModel] = useState(ai.model);
  const [keyInput, setKeyInput] = useState('');
  const [keyMasked, setKeyMasked] = useState('');
  const [checking, setChecking] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);

  useEffect(() => {
    void getAIKey().then(k => setKeyMasked(maskKey(k)));
  }, []);

  const enable = () => {
    setConsentOpen(false);
    actions.setAI({ enabled: true, consentAt: Date.now() });
    haptic('success');
  };

  const disable = () => {
    actions.setAI({ enabled: false });
  };

  const saveConn = async () => {
    actions.setAI({ baseUrl: baseUrl.trim(), model: model.trim() });
    if (keyInput.trim()) {
      await setAIKey(keyInput);
      setKeyInput('');
      setKeyMasked(maskKey(keyInput));
    }
    toast('已保存');
  };

  const check = async () => {
    setChecking(true);
    setModels(null);
    try {
      const list = await listModels({ baseUrl: baseUrl.trim() || ai.baseUrl, apiKey: keyInput.trim() || (await getAIKey()) });
      setModels(list);
      toast(list.length ? `连上了，可用 ${list.length} 个模型` : '连上了，但没有列出模型');
    } catch (e) {
      toast(e instanceof Error ? e.message : '连接失败', { type: 'error' });
    } finally {
      setChecking(false);
    }
  };

  const forgetKey = async () => {
    const ok = await confirm({
      title: '清除本机保存的密钥？',
      message: '清除后需要重新填写才能使用「记得」。',
      confirmText: '清除',
      destructive: true,
      icon: 'danger',
    });
    if (!ok) return;
    await clearAIKey();
    setKeyMasked('');
    toast('密钥已从这台设备清除');
  };

  const host = apiHost(baseUrl || ai.baseUrl);

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="记得" subtitle="它读你写的，问你、帮你整理、给你回信" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        {/* 简介卡 */}
        <View style={{ backgroundColor: c.card, borderRadius: 18, padding: 16, marginBottom: 14 }}>
          {[
            { icon: Sparkles, text: '写不下去时追问：顺着原文的具体细节接着问' },
            { icon: BookOpenText, text: '帮你整理：标题、心情、标签、和谁在一起' },
            { icon: MessageCircleHeart, text: '写完回一封短信，记得你以前写过的事' },
            { icon: EyeOff, text: '不替你写，不改写；隐藏日记永远不发' },
          ].map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
              <row.icon size={16} color={c.primaryDark} strokeWidth={1.7} />
              <Text style={{ flex: 1, fontSize: fs(13.5), color: c.text, lineHeight: fs(13.5) * 1.5 }}>{row.text}</Text>
            </View>
          ))}
        </View>

        <Group>
          <Row
            icon={Sparkles}
            iconColor={c.primaryDark}
            title="开启「记得」"
            subtitle={status === 'ready' ? '已就绪' : status === 'needs_setup' ? '已开启，还差配置' : '关闭中，日记不会离开这台设备'}
            right={<Switch value={ai.enabled} onChange={v => (v ? setConsentOpen(true) : disable())} />}
          />
        </Group>

        {ai.enabled && (
          <>
            <Group title="模型服务" footer="填一个 OpenAI 兼容接口。服务地址、模型名会保存在设置里；密钥只存在这台设备的安全存储中，不会进入备份和导出文件。">
              <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                <Field icon={Link2} value={baseUrl} onChangeText={setBaseUrl} placeholder="服务地址，如 https://api.example.com/v1" autoCapitalize="none" autoCorrect={false} />
                <Field value={model} onChangeText={setModel} placeholder="模型名" autoCapitalize="none" autoCorrect={false} />
                <Field icon={KeyRound} value={keyInput} onChangeText={setKeyInput} placeholder={keyMasked ? `已保存（${keyMasked}），输入可更换` : '密钥'} autoCapitalize="none" autoCorrect={false} secure />
                <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 6 }}>
                  <Button title="保存" size="md" style={{ flex: 1 }} onPress={() => void saveConn()} />
                  <Button
                    title={checking ? '检测中…' : '检测连接'}
                    variant="secondary"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => void check()}
                    disabled={checking}
                  />
                </View>
                {models && models.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 12 }}>
                    {models.slice(0, 8).map(m => (
                      <Pressable key={m} onPress={() => setModel(m)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: c.primaryFaint }}>
                        <Text style={{ fontSize: fs(12), color: c.primaryDark }}>{m}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </Group>

            <Group title="写完之后">
              <Row
                icon={MessageCircleHeart}
                iconColor={c.primaryDark}
                title="自动回信"
                subtitle="发布日记后，「记得」回一封短信"
                right={<Switch value={ai.autoReply} onChange={v => actions.setAI({ autoReply: v })} />}
              />
              <Row
                icon={BookOpenText}
                iconColor={c.primaryDark}
                title="提起以前写过的事"
                subtitle="回信时附上相关的旧日记片段，让回信有记忆"
                right={<Switch value={ai.useMemory} onChange={v => actions.setAI({ useMemory: v })} />}
              />
            </Group>

            <Group>
              <Row icon={Trash2} title="清除本机保存的密钥" danger onPress={() => void forgetKey()} />
            </Group>
          </>
        )}

        {/* 隐私说明 */}
        <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: fs(12), color: c.textMuted, lineHeight: fs(12) * 1.7 }}>
            使用「记得」时，当前这篇日记的文字{ai.useMemory && status === 'ready' ? '、以及几段相关的旧日记摘录' : ''}会发送到你填写的服务{host ? `（${host}）` : ''}。照片、视频、录音、位置不会发送；隐藏日记和已删除的日记永远不会发送。不开网络时，本机的追问和整理建议仍然可用。
          </Text>
        </View>
      </ScrollView>

      {/* 开启前的知情同意 */}
      <PopDialog accessibilityLabel="开启「记得」之前" visible={consentOpen} onClose={() => setConsentOpen(false)} maxWidth={380} style={{ padding: 24 }}>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ alignItems: 'center' }}>
          <Sparkles size={26} color={c.primaryDark} />
          <Text accessibilityRole="header" style={[t.h2, { fontSize: fs(18), marginTop: 12, textAlign: 'center' }]}>开启「记得」之前</Text>
          <Text style={[t.sub, { marginTop: 12, lineHeight: fs(13) * 1.7 }]}>
            开启后，你主动使用追问、整理、回信、回顾时，相关日记的文字会发送到你填写的模型服务。{'\n\n'}
            不会发送：照片、视频、录音、位置，以及设为隐藏和已删除的日记。{'\n'}
            随时可以在这里关掉，关掉后不再发出任何内容。
          </Text>
        </ScrollView>
        <View style={{ gap: 10, marginTop: 20 }}>
          <Button title="明白了，开启" size="md" onPress={enable} />
          <Button title="再想想" variant="secondary" size="md" onPress={() => setConsentOpen(false)} />
        </View>
      </PopDialog>
    </Screen>
  );
}
