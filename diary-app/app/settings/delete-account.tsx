import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions } from '../../src/store/store';
import { Button, NavBar, Screen, goBack } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';

/** 16. 注销账号确认（1:1 复刻设计稿3 #16） */
export default function DeleteAccountScreen() {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(false);

  const confirmDelete = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await actions.deleteAccount();
      toast('账号已注销');
      router.replace('/onboarding');
    } catch (error) {
      toast(error instanceof Error ? error.message : '暂时无法注销，请稍后重试', { type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="注销账号" />

      <View style={{ flex: 1, paddingHorizontal: 26, justifyContent: 'space-between', paddingVertical: 24 }}>
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <AlertTriangle size={30} color={c.danger} />
          </View>

          <Text style={[t.h1, { fontSize: fs(21), textAlign: 'center' }]}>确定要注销账号吗？</Text>
          <Text style={[t.sub, { textAlign: 'center', marginTop: 12, lineHeight: fs(13) * 1.65 }]}>
            注销后将删除当前账号及其日记、已同步附件和本机快照，该操作不可恢复。建议先在「备份与恢复」里做一次手动备份。
          </Text>

          <View style={{ width: '100%', backgroundColor: c.card, borderRadius: 16, padding: 18, marginTop: 24, gap: 10 }}>
            {[
              '• 当前账号在本机的数据将被删除',
              '• 本地模式与其他账号的日记仍会保留',
              '• 无法使用原账号重新登录恢复数据',
            ].map(line => (
              <Text key={line} style={{ fontSize: fs(13.5), color: c.textSub, lineHeight: fs(13.5) * 1.5 }}>{line}</Text>
            ))}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Button title="确认注销账号" variant="danger" loading={loading} onPress={() => void confirmDelete()} />
          <Button title="取消" variant="secondary" disabled={loading} onPress={goBack} />
        </View>
      </View>
    </Screen>
  );
}
