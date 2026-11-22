import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, View } from 'react-native';
import { Text } from '../../src/components/text';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getEditorDraft, setEditorPhotos, trackEditorPhotos } from '../../src/store/editorSession';
import { PHOTO_ASSET_KEYS } from '../../src/data/assets';
import { Button, NavBar, Photo, PillAction, Screen, Segmented, SelectBadge, goBack, haptic, webSpaceAction } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { actions } from '../../src/store/store';
import { storePhoto } from '../../src/services/photoStore';
import { uid } from '../../src/utils/text';

export default function PhotoPickerScreen() {
  const { c, t, fs, r } = useTheme();
  const { toast } = useFeedback();
  const initial = useRef(getEditorDraft());
  const mounted = useRef(true);
  const running = useRef(false);
  const [tab, setTab] = useState<'personal' | 'samples'>('personal');
  const [personal, setPersonal] = useState<string[]>(() => initial.current?.entry.photos ?? []);
  const [selected, setSelected] = useState<string[]>(() => initial.current?.entry.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const photos = useMemo(() => tab === 'personal' ? personal : PHOTO_ASSET_KEYS.map(key => `asset:${key}`), [personal, tab]);

  const toggle = (uri: string) => {
    if (running.current) return;
    haptic('light');
    setSelected(cur => cur.includes(uri) ? cur.filter(x => x !== uri) : [...cur, uri]);
  };

  const pick = async (camera: boolean) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError('');
    try {
      if (!camera) actions.markPermissionAsked('photos');
      if (Platform.OS !== 'web') {
        const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError(camera ? '相机权限未开启，已有照片仍保留。也可以从设备选择。' : '相册权限未开启，已有照片仍保留。');
          toast('需要照片访问权限', { type: 'denied', action: { label: '去设置', onPress: () => void Linking.openSettings() } });
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
      if (result.canceled) return;
      const stored: string[] = [];
      let failed = 0;
      for (const asset of result.assets) {
        try {
          const photo = await storePhoto(uid('photo'), asset.uri, { blob: asset.file });
          if (photo.durable) stored.push(photo.uri); else failed++;
        } catch { failed++; }
      }
      // Files are tracked even when the picker is dismissed without applying changes.
      if (getEditorDraft()?.entry.id === initial.current?.entry.id) trackEditorPhotos(stored);
      else actions.releasePhotos(stored);
      if (!mounted.current) return;
      if (stored.length) {
        setPersonal(cur => [...new Set([...stored, ...cur])]);
        setSelected(cur => [...new Set([...cur, ...stored])]);
        setTab('personal'); haptic('success');
      }
      if (failed) setError(`${failed} 张照片未能保存到本机，请重试或释放存储空间。${stored.length ? `其余 ${stored.length} 张已选中。` : ''}`);
    } catch { if (mounted.current) setError(camera ? '无法打开相机，可以从设备选择照片。' : '无法读取照片，请重新选择。'); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  };

  const done = () => {
    if (running.current) return;
    if (!initial.current || getEditorDraft()?.entry.id !== initial.current.entry.id) { setError('请先打开一篇日记，再添加照片'); return; }
    setEditorPhotos(selected);
    goBack();
  };

  return (
    <Screen enter="rise" edges={['top', 'bottom']}>
      <NavBar title="选择照片" right={<PillAction label={busy ? '保存照片中…' : `完成 (${selected.length})`} disabled={busy} onPress={done} />} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button title="从设备选择" icon={ImagePlus} variant="secondary" disabled={busy} onPress={() => void pick(false)} style={{ flex: 1, minWidth: 140 }} />
          <Button title="拍照" icon={Camera} variant="secondary" disabled={busy} onPress={() => void pick(true)} style={{ minWidth: 88 }} />
        </View>
        <Segmented value={tab} onChange={setTab} items={[{ key: 'personal', label: '本篇照片' }, { key: 'samples', label: '示例素材' }]} />
        <Text style={t.caption}>{tab === 'samples' ? '应用内置的风景素材，可自行选用。' : '显示本篇已有及本次导入的照片，取消勾选后点完成即可移除。'}</Text>
        {!!error && <Text accessibilityRole="alert" style={[t.sub, { color: c.danger }]}>{error}</Text>}
      </View>
      <FlatList
        data={photos} numColumns={3} keyExtractor={uri => uri} extraData={[selected, busy]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        columnWrapperStyle={{ gap: 6, marginBottom: 6 }} initialNumToRender={18} windowSize={5}
        ListEmptyComponent={<View style={{ padding: 28, alignItems: 'center', gap: 12 }}><ImagePlus size={32} color={c.textMuted} /><Text style={[t.sub, { textAlign: 'center' }]}>还没有照片，选择设备中的照片，留住这一刻。</Text></View>}
        renderItem={({ item: uri, index }) => {
          const selectedIndex = selected.indexOf(uri);
          const checked = selectedIndex !== -1;
          return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} aria-checked={checked} accessibilityLabel={`${tab === 'samples' ? '示例素材' : '照片'} ${index + 1}`} disabled={busy} {...webSpaceAction(() => toggle(uri), busy)} onPress={() => toggle(uri)} style={{ width: '32%', aspectRatio: 1, borderRadius: r(10), overflow: 'hidden', borderWidth: checked ? 2 : 0, borderColor: c.primary }}>
            <Photo uri={uri} style={{ width: '100%', height: '100%' }} radius={0} />
            <View pointerEvents="none" style={{ position: 'absolute', top: 6, right: 6 }}><SelectBadge checked={checked} index={checked ? selectedIndex + 1 : undefined} /></View>
          </Pressable>;
        }}
      />
    </Screen>
  );
}
