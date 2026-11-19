import React, { useEffect, useRef, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play, VideoOff, X } from 'lucide-react-native';
import type { VideoClip } from '../store/types';
import { useTheme } from '../theme/ThemeProvider';
import { posterUri, resolveVideoUri } from '../services/videoStore';
import { fmtDuration } from '../utils/date';
import { videoAspect } from '../utils/video';
import { PressableScale } from './motion';
import { Photo } from './ui';

/** 与照片删除钮、张数角标相同的深色半透明底 */
const SCRIM = 'rgba(47,42,38,0.65)';

/** 真正的播放器：点了播放才挂载，避免一篇日记里每段视频都提前占一个解码器 */
function InlinePlayer({ uri, onError }: { uri: string; onError: () => void }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = false;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onError();
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: '100%', height: '100%', backgroundColor: '#12100E' }}
    />
  );
}

/**
 * 日记里的一段视频：封面 + 播放钮，点开后就地播放（系统自带的进度条与全屏）。
 *
 * 没有新增视觉样式，全部取自已有元素：
 *  - 外框 = PhotoLayoutView 的单张照片（同样的圆角 14、占位底色）
 *  - 右上角删除钮 = 照片上的删除钮
 *  - 中间播放钮 = 语音条 AudioBar 的圆形播放钮
 *  - 右下角时长 = 列表缩略图上的张数角标
 */
export function VideoClipCard({
  clip,
  onRemove,
  autoPlay,
  style,
}: {
  clip: VideoClip;
  onRemove?: () => void;
  /** 挂载后立即开始播放（影像记忆里点开一段视频时） */
  autoPlay?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, fs } = useTheme();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'playing' | 'missing' | 'failed'>('idle');
  const [src, setSrc] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const start = async () => {
    if (phase === 'loading' || phase === 'playing') return;
    setPhase('loading');
    const url = await resolveVideoUri(clip.uri);
    if (!alive.current) return;
    if (!url) {
      setPhase('missing');
      return;
    }
    setSrc(url);
    setPhase('playing');
  };

  useEffect(() => {
    if (autoPlay) void start();
    // 只在挂载时触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playing = phase === 'playing' && !!src;
  const broken = phase === 'missing' || phase === 'failed';

  return (
    <View style={[{ width: '100%', aspectRatio: videoAspect(clip), borderRadius: 14, overflow: 'hidden', backgroundColor: c.primarySoft }, style]}>
      {playing ? (
        <InlinePlayer uri={src} onError={() => setPhase('failed')} />
      ) : (
        <PressableScale
          scaleTo={0.985}
          disabled={broken}
          onPress={() => void start()}
          accessibilityRole="button"
          accessibilityLabel={clip.duration > 0 ? `播放视频，时长 ${fmtDuration(clip.duration)}` : '播放视频'}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Photo uri={posterUri(clip.poster)} style={StyleSheet.absoluteFill} radius={0} />
          {broken ? (
            <View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: SCRIM, maxWidth: '86%' }}>
              <VideoOff size={18} color="#fff" strokeWidth={1.7} />
              <Text style={{ color: '#fff', fontSize: fs(12), textAlign: 'center' }}>
                {phase === 'missing' ? '视频文件不在这台设备上' : '这段视频暂时无法播放'}
              </Text>
            </View>
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: c.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: phase === 'loading' ? 0.6 : 1,
                shadowColor: c.primaryDark,
                shadowOpacity: 0.25,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
            </View>
          )}
          {clip.duration > 0 && !broken && (
            <View style={{ position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: SCRIM }}>
              <Text style={{ color: '#fff', fontSize: 11, fontVariant: ['tabular-nums'] }}>{fmtDuration(clip.duration)}</Text>
            </View>
          )}
        </PressableScale>
      )}

      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityLabel="移除视频"
          style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: SCRIM, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={14} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

/** 缩略图上的「这是视频」角标：播放小三角 + 时长，样式同张数角标 */
export function VideoBadge({ duration, style }: { duration?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: SCRIM, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }, style]}>
      <Play size={8} color="#fff" fill="#fff" />
      {!!duration && <Text style={{ color: '#fff', fontSize: 10, fontVariant: ['tabular-nums'] }}>{fmtDuration(duration)}</Text>}
    </View>
  );
}
