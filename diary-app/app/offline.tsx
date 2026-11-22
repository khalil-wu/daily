import React, { useSyncExternalStore } from 'react';
import { getPersistenceError, subscribePersistenceError } from '../src/store/storage';
import { Image, View } from 'react-native';
import { Text } from '../src/components/text';
import { CloudOff } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, NavBar, Screen, goBack } from '../src/components/ui';
import { IMAGES } from '../src/data/assets';

/** 13. 离线状态提示（1:1 复刻设计稿3 #13） */
export default function OfflineScreen() {
  const { c, t, fs, dark } = useTheme();
  const error = useSyncExternalStore(subscribePersistenceError, getPersistenceError, getPersistenceError);

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 36 }}>
          <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <CloudOff size={28} color={c.primaryDark} strokeWidth={1.6} />
          </View>
          <Text style={[t.h1, { fontSize: fs(22), textAlign: 'center' }]}>离线也可以继续记录</Text>
          <Text style={[t.sub, { textAlign: 'center', marginTop: 14, lineHeight: fs(13.5) * 1.75 }]}>
            {error || '无需网络也能写日记。请留意编辑页的保存状态，确认内容已写入设备。'}{'\n'}云端同步和 AI 回信需要网络，联网后可重新尝试。清理浏览器数据前，请先导出备份。
          </Text>
        </View>

        <View style={{ alignItems: 'center', paddingHorizontal: 26, paddingBottom: 20, gap: 22 }}>
          <View
            style={{
              width: 184,
              height: 184,
              borderRadius: dark ? 92 : 0,
              backgroundColor: dark ? 'rgba(236,246,247,0.92)' : 'transparent',
              padding: dark ? 16 : 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image source={IMAGES.cloudSync} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
          <Button title="知道了" onPress={goBack} />
        </View>
      </View>
    </Screen>
  );
}
