import React from 'react';
import { Linking, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Bell, Image as ImageIcon, Mic } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useTheme } from '../theme/ThemeProvider';
import { actions } from '../store/store';
import { Button, Group, Row } from './ui';
import { useFeedback } from './feedback';

export function PermissionModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();

  const openSysSettings = () => {
    if (Platform.OS !== 'web') void Linking.openSettings();
  };

  const askPhotos = async () => {
    actions.markPermissionAsked('photos');
    if (Platform.OS === 'web') {
      toast('网页端已支持直接选择本地图片');
      return;
    }
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.granted) toast('已获得相册访问权限');
    else toast('权限被拒绝', { type: 'denied', message: '你已拒绝“相册”权限，可前往系统设置中开启。', action: { label: '去设置', onPress: openSysSettings } });
  };

  const askMic = async () => {
    actions.markPermissionAsked('microphone');
    if (Platform.OS === 'web') {
      toast('请在浏览器弹窗中允许麦克风访问', { type: 'info' });
      return;
    }
    const res = await requestRecordingPermissionsAsync();
    if (res.granted) toast('已获得麦克风权限');
    else toast('权限被拒绝', { type: 'denied', message: '你已拒绝“麦克风”权限，可前往系统设置中开启。', action: { label: '去设置', onPress: openSysSettings } });
  };

  const askNotify = async () => {
    actions.markPermissionAsked('notifications');
    if (Platform.OS === 'web') {
      toast('浏览器通知提醒可在系统设置中管理', { type: 'info' });
      return;
    }
    const res = await Notifications.requestPermissionsAsync();
    if (res.granted) toast('已开启通知提醒权限');
    else toast('权限被拒绝', { type: 'denied', message: '你已拒绝“通知”权限，可前往系统设置中开启。', action: { label: '去设置', onPress: openSysSettings } });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 34 }}>
          <Text style={[t.h1, { textAlign: 'center', fontSize: fs(21) }]}>需要以下权限</Text>
          <Text style={[t.sub, { textAlign: 'center', marginTop: 8, marginBottom: 20 }]}>为提供更完整的记录体验，建议授予以下权限：</Text>

          <Group>
            <Row icon={ImageIcon} iconColor={c.primaryDark} title="相册" subtitle="用于插入照片到日记中" value="去授权" onPress={() => void askPhotos()} />
            <Row icon={Mic} iconColor={c.primaryDark} title="麦克风" subtitle="用于录制语音日记" value="去授权" onPress={() => void askMic()} />
            <Row icon={Bell} iconColor={c.primaryDark} title="通知" subtitle="用于每日提醒与重要事项提醒" value="去授权" onPress={() => void askNotify()} />
          </Group>

          <Button title="稍后再说" variant="soft" onPress={onClose} style={{ marginTop: 10 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
