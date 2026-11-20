import React from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudOff } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, NavBar, Screen, goBack } from '../src/components/ui';
import { IMAGES } from '../src/data/assets';

/** 13. 离线状态提示（1:1 复刻设计稿3 #13） */
export default function OfflineScreen() {
  const { c, t, fs, dark } = useTheme();

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 36 }}>
          <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <CloudOff size={28} color={c.primaryDark} strokeWidth={1.6} />
          </View>
          <Text style={[t.h1, { fontSize: fs(22), textAlign: 'center' }]}>当前处于离线状态</Text>
          <Text style={[t.sub, { textAlign: 'center', marginTop: 14, lineHeight: fs(13.5) * 1.75 }]}>
            无法连接到网络{'\n'}你仍可以正常记录日记，所有内容已安全保存在本地。{'\n'}网络恢复后即可继续使用「记得」。
          </Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <View style={{ width: '100%', height: 220, overflow: 'hidden', alignItems: 'center' }}>
            <Image source={IMAGES.offlineField} style={{ width: '100%', height: '100%', opacity: dark ? 0.55 : 0.96 }} resizeMode="cover" />
            <LinearGradient colors={[c.bg, 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56 }} />
          </View>
          <View style={{ width: '100%', paddingHorizontal: 26, paddingBottom: 20, marginTop: -24 }}>
            <Button title="知道了" onPress={goBack} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
