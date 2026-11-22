import React, { useState } from 'react';
import { Image, Linking, Platform, ScrollView, View } from 'react-native';
import { Text } from './text';
import { Bell, Image as ImageIcon, Mic } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useTheme } from '../theme/ThemeProvider';
import { actions } from '../store/store';
import { IMAGES } from '../data/assets';
import { Button, Group, Row } from './ui';
import { BottomSheet } from './motion';

type Permission = 'photos' | 'microphone' | 'notifications';
export function PermissionModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c, t, r, dark } = useTheme();
  const [message, setMessage] = useState('');
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<Permission | null>(null);

  const ask = async (kind: Permission) => {
    if (busy) return;
    setBusy(kind);
    setDenied(false);
    setMessage('');
    actions.markPermissionAsked(kind);
    try {
      if (Platform.OS === 'web') {
        if (kind === 'photos') setMessage('网页端选择照片时可直接打开文件选择器，无需授予整个相册的访问权限。');
        else if (kind === 'notifications') setMessage('网页端暂不支持每日后台通知。你可以在手机应用中开启日记提醒。');
        else if (!globalThis.navigator?.mediaDevices?.getUserMedia) setMessage('当前浏览器无法访问麦克风。请使用 HTTPS 安全连接，或在手机应用中录音。');
        else {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          setMessage('已获得麦克风权限，写日记时可以录制语音。');
        }
        return;
      }
      const result = kind === 'photos' ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : kind === 'microphone' ? await requestRecordingPermissionsAsync() : await Notifications.requestPermissionsAsync();
      if (result.granted) setMessage(`已获得${kind === 'photos' ? '相册' : kind === 'microphone' ? '麦克风' : '通知'}权限。`);
      else { setDenied(true); setMessage('尚未获得权限。你可以在系统设置中开启，也可以继续使用其他记录功能。'); }
    } catch {
      setDenied(Platform.OS !== 'web');
      setMessage(Platform.OS === 'web' ? '未能获得麦克风权限。请检查浏览器的网站权限后重试。' : '暂时无法请求权限，请检查系统设置后重试。');
    } finally { setBusy(null); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="记录权限">
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View
            style={{
              width: 82,
              height: 82,
              borderRadius: dark ? 41 : 0,
              backgroundColor: dark ? 'rgba(236,246,247,0.92)' : 'transparent',
              padding: dark ? 8 : 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image source={IMAGES.privacyLock} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
        </View>
        <Text style={[t.sub, { marginBottom: 16, textAlign: 'center' }]}>按需开启，用到时再授权也可以。</Text>
        <Group>
          <Row icon={ImageIcon} iconColor={c.primaryDark} title="相册" subtitle="用于插入照片到日记中" value={busy === 'photos' ? '请求中…' : Platform.OS === 'web' ? '查看说明' : '去授权'} onPress={() => void ask('photos')} />
          <Row icon={Mic} iconColor={c.primaryDark} title="麦克风" subtitle="用于录制语音日记" value={busy === 'microphone' ? '请求中…' : '去授权'} onPress={() => void ask('microphone')} />
          <Row icon={Bell} iconColor={c.primaryDark} title="通知" subtitle={Platform.OS === 'web' ? '网页端暂不支持后台提醒' : '用于每日提醒与重要事项提醒'} value={busy === 'notifications' ? '请求中…' : Platform.OS === 'web' ? '查看说明' : '去授权'} onPress={() => void ask('notifications')} />
        </Group>
        {!!message && <View style={{ padding: 14, borderRadius: r(12), backgroundColor: c.cardAlt, marginBottom: 12 }}>
          <Text accessibilityLiveRegion="polite" style={t.sub}>{message}</Text>
          {denied && <Button title="打开系统设置" variant="secondary" size="md" onPress={() => { void Linking.openSettings().catch(() => setMessage('无法打开系统设置，请手动进入设置管理权限。')); }} style={{ marginTop: 12 }} />}
        </View>}
      </ScrollView>
      <Button title="稍后再说" variant="soft" onPress={onClose} style={{ marginTop: 10 }} />
    </BottomSheet>
  );
}
