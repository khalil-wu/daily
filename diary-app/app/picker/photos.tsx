import React, { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { addEditorPhotos, getEditorDraft } from '../../src/store/editorSession';
import { PHOTO_ASSET_KEYS } from '../../src/data/assets';
import { NavBar, Photo, PillAction, Screen, Segmented, SelectBadge, goBack, haptic } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { actions } from '../../src/store/store';
import { storePhoto } from '../../src/services/photoStore';
import { uid } from '../../src/utils/text';

const ALBUMS = [
  { title: '山野与天空', keys: ['asset:photo-mountain', 'asset:photo-sky', 'asset:photo-lake', 'asset:photo-road', 'asset:photo-sunset', 'asset:photo-mist'] },
  { title: '田野与花木', keys: ['asset:photo-reeds', 'asset:photo-field', 'asset:photo-blossom', 'asset:photo-flowers', 'asset:photo-daisy', 'asset:photo-cloud'] },
  { title: '日常与静物', keys: ['asset:photo-coffee', 'asset:photo-tea', 'asset:photo-dried', 'asset:photo-street'] },
];

/** 7. 图片插入 / 相册选择页（1:1 复刻设计稿2 #7） */
export default function PhotoPickerScreen() {
  const { c, fs } = useTheme();
  const { toast } = useFeedback();
  const [tab, setTab] = useState<'recent' | 'album'>('recent');
  const [customUris, setCustomUris] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(() => getEditorDraft()?.entry.photos ?? []);
  const [busy, setBusy] = useState(false);

  const allPhotos = useMemo(() => [...customUris, ...PHOTO_ASSET_KEYS.map(k => `asset:${k}`)], [customUris]);

  const toggle = (uri: string) => {
    haptic('light');
    setSelected(cur => (cur.includes(uri) ? cur.filter(x => x !== uri) : [...cur, uri]));
  };

  /**
   * 相册 / 相机交回来的照片地址都是临时的（原生在缓存目录，网页是 blob: 地址，
   * 刷新就失效），先把文件收进应用自己的空间，日记里记能长期使用的地址。
   */
  const ingest = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const stored: string[] = [];
    let temporary = false;
    setBusy(true);
    try {
      for (const asset of assets) {
        const res = await storePhoto(uid('photo'), asset.uri, { blob: asset.file });
        if (!res.durable) temporary = true;
        stored.push(res.uri);
      }
    } finally {
      setBusy(false);
    }
    if (stored.length) {
      setCustomUris(cur => [...stored, ...cur]);
      setSelected(cur => Array.from(new Set([...cur, ...stored])));
    }
    if (temporary) {
      toast('有照片没能存进应用', {
        type: 'info',
        message: Platform.OS === 'web' ? '当前浏览器无法保存照片文件，刷新页面后需要重新添加。' : '没能把照片存进应用，建议重新添加一次。',
      });
    } else if (stored.length) {
      haptic('success');
      toast(`已选中 ${stored.length} 张手机照片`);
    }
  };

  const openSystemAlbum = async () => {
    if (busy) return;
    actions.markPermissionAsked('photos');
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          toast('权限被拒绝', {
            type: 'denied',
            message: '你已拒绝“相册”权限，无法添加照片。',
            action: { label: '去设置', onPress: () => void Linking.openSettings() },
          });
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (!res.canceled && res.assets?.length) await ingest(res.assets);
    } catch {
      toast('无法打开系统相册', { type: 'warning' });
    }
  };

  const takePhoto = async () => {
    if (busy) return;
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast('权限被拒绝', {
            type: 'denied',
            message: '需要相机权限才能拍照记录',
            action: { label: '去设置', onPress: () => void Linking.openSettings() },
          });
          return;
        }
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      if (!res.canceled && res.assets[0]?.uri) await ingest([res.assets[0]]);
    } catch {
      toast('当前设备暂不支持直接调用相机，可从相册选取', { type: 'info' });
    }
  };

  const done = () => {
    addEditorPhotos(selected);
    goBack();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title="选择照片"
        right={<PillAction label={selected.length ? `完成 (${selected.length})` : '完成'} onPress={done} />}
      />

      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { key: 'recent', label: '最近项目' },
            { key: 'album', label: '相册' },
          ]}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => void openSystemAlbum()}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}
          >
            <ImagePlus size={16} color={c.primaryDark} />
            <Text style={{ fontSize: fs(13), color: c.text }}>从手机相册导入</Text>
          </Pressable>
          <Pressable
            onPress={() => void takePhoto()}
            style={{ width: 108, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}
          >
            <Camera size={16} color={c.primaryDark} />
            <Text style={{ fontSize: fs(13), color: c.text }}>拍照</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
        {tab === 'recent' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {allPhotos.map(uri => {
              const idx = selected.indexOf(uri);
              const checked = idx !== -1;
              return (
                <Pressable
                  key={uri}
                  onPress={() => toggle(uri)}
                  style={{ width: '32%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', borderWidth: checked ? 2 : 0, borderColor: c.primary }}
                >
                  <Photo uri={uri} style={{ width: '100%', height: '100%' }} radius={0} />
                  <View style={{ position: 'absolute', top: 6, right: 6 }}>
                    <SelectBadge checked={checked} index={checked ? idx + 1 : undefined} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            {ALBUMS.map(grp => (
              <View key={grp.title}>
                <Text style={{ fontSize: fs(13.5), color: c.textSub, fontWeight: '500', marginBottom: 8, marginLeft: 4 }}>{grp.title}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {grp.keys.map(uri => {
                    const idx = selected.indexOf(uri);
                    const checked = idx !== -1;
                    return (
                      <Pressable
                        key={uri}
                        onPress={() => toggle(uri)}
                        style={{ width: '32%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', borderWidth: checked ? 2 : 0, borderColor: c.primary }}
                      >
                        <Photo uri={uri} style={{ width: '100%', height: '100%' }} radius={0} />
                        <View style={{ position: 'absolute', top: 6, right: 6 }}>
                          <SelectBadge checked={checked} index={checked ? idx + 1 : undefined} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
