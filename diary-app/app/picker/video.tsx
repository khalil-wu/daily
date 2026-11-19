import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FolderOpen, Video } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { addEditorVideos } from '../../src/store/editorSession';
import { actions } from '../../src/store/store';
import type { VideoClip } from '../../src/store/types';
import { EmptyState, NavBar, PillAction, Screen, goBack, haptic } from '../../src/components/ui';
import { PressableScale } from '../../src/components/motion';
import { VideoClipCard } from '../../src/components/VideoPlayer';
import { useFeedback } from '../../src/components/feedback';
import { makePoster, resolveVideoUri, storeVideo } from '../../src/services/videoStore';
import { IMAGES } from '../../src/data/assets';
import { fmtDuration } from '../../src/utils/date';
import { uid } from '../../src/utils/text';
import { MAX_VIDEO_SECONDS, clipDuration, isVideoTooLong, videoSeconds } from '../../src/utils/video';

/**
 * 能不能直接拍：原生端可以；网页端只有手机浏览器能调起摄像头，
 * 电脑浏览器上「拍摄」只会再弹一次文件选择，所以干脆不显示这个入口。
 */
const canRecord =
  Platform.OS !== 'web' ||
  (typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints ?? 0) > 0 &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? ''));

/**
 * 视频添加页：从相册选，或直接拍一段。
 * 页面结构沿用「选择照片」页（导航栏右侧完成胶囊 + 顶部两个入口按钮 + 下方内容区），
 * 已选的视频用 VideoClipCard 展示，可就地试看、移除。
 */
export default function VideoPickerScreen() {
  const { c, fs } = useTheme();
  const { toast } = useFeedback();
  const [picked, setPicked] = useState<VideoClip[]>([]);
  const [busy, setBusy] = useState(false);
  const pickedRef = useRef<VideoClip[]>([]);
  pickedRef.current = picked;
  const committed = useRef(false);

  // 没点「完成」就离开：这次选的视频没有进日记，把已经收进来的文件清掉
  useEffect(
    () => () => {
      if (!committed.current) actions.releaseVideos(pickedRef.current);
    },
    [],
  );

  /** 把相册 / 相机交回来的视频收进应用：检查时长 → 存文件 → 取封面 */
  const ingest = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const unit = Platform.OS === 'web' ? 's' : 'ms';
    const added: VideoClip[] = [];
    const tooLong: number[] = [];
    let temporary = false;

    setBusy(true);
    try {
      for (const asset of assets) {
        const seconds = videoSeconds(asset.duration, unit);
        if (isVideoTooLong(seconds)) {
          tooLong.push(seconds);
          continue;
        }
        const id = uid('vid');
        const stored = await storeVideo(id, asset.uri, { blob: asset.file });
        if (!stored.durable) temporary = true;
        const playable = (await resolveVideoUri(stored.uri)) ?? asset.uri;
        const poster = await makePoster(id, playable, seconds);
        added.push({
          id,
          uri: stored.uri,
          duration: clipDuration(seconds),
          poster: poster?.uri,
          width: poster?.width || asset.width || undefined,
          height: poster?.height || asset.height || undefined,
          createdAt: Date.now(),
        });
      }
    } finally {
      setBusy(false);
    }

    if (added.length) {
      haptic('success');
      setPicked(cur => [...cur, ...added]);
    }

    if (tooLong.length) {
      toast(
        tooLong.length === 1 && !added.length
          ? `这段视频有 ${fmtDuration(Math.round(tooLong[0]))}，超过 ${MAX_VIDEO_SECONDS} 秒上限`
          : `有 ${tooLong.length} 段超过 ${MAX_VIDEO_SECONDS} 秒，没有添加`,
        { type: 'warning', message: '可以先在相册里把它剪短，再重新选择。' },
      );
    } else if (temporary) {
      toast('视频暂时只能在这次打开期间播放', {
        type: 'info',
        message: Platform.OS === 'web' ? '当前浏览器无法保存视频文件，刷新页面后需要重新添加。' : '没能把视频存进应用，建议重新添加一次。',
      });
    } else if (added.length) {
      toast(`已选好 ${added.length} 段视频`);
    }
  };

  const openLibrary = async () => {
    if (busy) return;
    actions.markPermissionAsked('photos');
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          toast('权限被拒绝', {
            type: 'denied',
            message: '你已拒绝“相册”权限，无法添加视频。',
            action: { label: '去设置', onPress: () => void Linking.openSettings() },
          });
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: true });
      if (!res.canceled && res.assets?.length) await ingest(res.assets);
    } catch {
      toast(Platform.OS === 'web' ? '无法读取这个文件，请换一段视频试试' : '无法打开系统相册', { type: 'warning' });
    }
  };

  const record = async () => {
    if (busy) return;
    actions.markPermissionAsked('camera');
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast('权限被拒绝', {
            type: 'denied',
            message: '需要相机权限才能拍摄视频',
            action: { label: '去设置', onPress: () => void Linking.openSettings() },
          });
          return;
        }
      }
      // 到 60 秒相机会自动停止；个别安卓相机不理会这个上限，所以拍完还会再检查一次
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: MAX_VIDEO_SECONDS });
      if (!res.canceled && res.assets?.length) await ingest(res.assets);
    } catch {
      toast('当前设备暂不支持直接拍摄，可从相册选取', { type: 'info' });
    }
  };

  const remove = (clip: VideoClip) => {
    haptic('light');
    setPicked(cur => cur.filter(v => v.id !== clip.id));
    actions.releaseVideos([clip]);
  };

  const done = () => {
    committed.current = true;
    addEditorVideos(picked);
    goBack();
  };

  const entryBtn = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
    opacity: busy ? 0.55 : 1,
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title="添加视频"
        right={<PillAction label={picked.length ? `完成 (${picked.length})` : '完成'} onPress={done} disabled={busy} />}
      />

      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PressableScale disabled={busy} onPress={() => void openLibrary()} style={[entryBtn, { flex: 1 }]}>
            <FolderOpen size={16} color={c.primaryDark} />
            <Text style={{ fontSize: fs(13), color: c.text }}>{Platform.OS === 'web' ? '选择视频文件' : '从手机相册选择'}</Text>
          </PressableScale>
          {canRecord && (
            <PressableScale disabled={busy} onPress={() => void record()} style={[entryBtn, { width: 108 }]}>
              <Video size={16} color={c.primaryDark} />
              <Text style={{ fontSize: fs(13), color: c.text }}>拍摄</Text>
            </PressableScale>
          )}
        </View>
        <Text style={{ fontSize: fs(12), color: busy ? c.primaryDark : c.textMuted, marginLeft: 4 }}>
          {busy
            ? '正在处理视频，请稍候…'
            : `单段最长 ${MAX_VIDEO_SECONDS} 秒，可一次选多段${canRecord ? '' : ' · 电脑网页端不能直接拍摄，请选拍好的视频'}`}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, flexGrow: 1 }}>
        {picked.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
            <EmptyState
              image={IMAGES.emptyBook}
              imageSize={150}
              title="还没有选择视频"
              desc="拍一段此刻，或从相册里挑一段，让这篇日记动起来。"
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {picked.map(clip => (
              <VideoClipCard key={clip.id} clip={clip} onRemove={() => remove(clip)} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
